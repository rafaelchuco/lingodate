const delay = 1800;
const clientId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

function gather(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', changed);
      resolve();
    };
    const changed = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, 6500);
    pc.addEventListener('icegatheringstatechange', changed);
  });
}

export class Call {
  constructor(id, request, events) {
    this.id = id;
    this.request = request;
    this.events = events;
    this.client = clientId();
    this.tracks = new Map();
    this.translation = false;
    this.closed = false;
    this.version = 0;
  }
  sendRequest(suffix = '', data, client = this.client) {
    return this.request('/rooms/' + this.id + suffix, data === undefined ? 'GET' : 'POST', data, { 'X-Lingo-Client': client });
  }
  async start() {
    const version = ++this.version;
    clearTimeout(this.timer);
    this.reset();
    const room = await this.sendRequest('/join', {});
    if (this.closed || this.version !== version) return;
    this.role = room.role;
    this.title = room.title;
    this.iceServers = room.iceServers;
    this.expires = room.expires;
    this.epoch = room.epoch;
    this.events.status('waiting');
    this.poll(version);
  }
  restart() {
    this.client = clientId();
    this.translation = false;
    return this.start();
  }
  reset() {
    const pc = this.pc, channel = this.channel;
    this.pc = this.channel = this.transceivers = null;
    this.signaled = false;
    this.events.channel(false);
    channel?.close();
    pc?.close();
    this.events.remote(new MediaStream());
    this.events.peerMedia({ mic: false, camera: false });
  }
  async poll(version) {
    const active = () => !this.closed && this.version === version;
    try {
      const room = await this.sendRequest();
      if (!active()) return;
      if (this.epoch !== room.epoch) {
        this.epoch = room.epoch;
        this.reset();
      }
      this.events.peer(room.peer);
      if (!room.peer) {
        this.events.status('waiting');
      } else if (this.role === 'host' || room.offer) {
        if (!this.pc) this.makePeer();
        const pc = this.pc;
        if (!this.signaled) {
          if (!pc.localDescription) {
            if (this.role === 'host') {
              await pc.setLocalDescription(await pc.createOffer());
            } else {
              await pc.setRemoteDescription(room.offer);
              this.transceivers = Object.fromEntries(pc.getTransceivers().map(tr => [tr.receiver.track.kind, tr]));
              for (const [kind, tr] of Object.entries(this.transceivers)) {
                tr.direction = 'sendrecv';
                await tr.sender.replaceTrack(this.tracks.get(kind) || null);
              }
              await pc.setLocalDescription(await pc.createAnswer());
            }
            await gather(pc);
          }
          if (!active() || this.pc !== pc) return;
          // A response can be lost after the server commits. An existing
          // signal in this generation means there is no need to resend it.
          if (!(this.role === 'host' ? room.offer : room.answer)) {
            await this.sendRequest('/signal', { ...pc.localDescription.toJSON(), epoch: this.epoch });
          }
          if (!active() || this.pc !== pc) return;
          this.signaled = true;
        }
        if (this.role === 'host' && room.answer && !pc.remoteDescription) await pc.setRemoteDescription(room.answer);
      }
    } catch (error) {
      if (!active()) return;
      if ([401, 403, 404].includes(error.status)) {
        this.stop();
        this.events.ended(error.message);
      } else if (error.status !== 409) {
        this.events.problem(error.message || 'No se pudo conectar.');
      }
    } finally {
      if (active()) this.timer = setTimeout(() => this.poll(version), this.pc?.connectionState === 'connected' ? 7000 : delay);
    }
  }
  makePeer() {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    this.events.status('connecting');
    const remote = new MediaStream();
    pc.ontrack = event => {
      if (this.pc !== pc) return;
      remote.addTrack(event.track);
      this.events.remote(remote);
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const state = pc.connectionState;
      this.events.status(state === 'new' ? 'connecting' : state);
    };
    if (this.role === 'host') {
      this.transceivers = Object.fromEntries(['audio', 'video'].map(kind => {
        const tr = pc.addTransceiver(this.tracks.get(kind) || kind, { direction: 'sendrecv' });
        return [kind, tr];
      }));
      this.setChannel(pc.createDataChannel('lingolite'));
    } else {
      pc.ondatachannel = ({ channel }) => { if (this.pc === pc) this.setChannel(channel); };
    }
  }
  setChannel(channel) {
    this.channel = channel;
    channel.onopen = () => {
      if (this.channel !== channel) return;
      this.events.channel(true);
      this.sendMediaState();
    };
    channel.onclose = () => { if (this.channel === channel) this.events.channel(false); };
    channel.onmessage = event => {
      if (this.channel !== channel || typeof event.data !== 'string' || event.data.length > 4096) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.kind === 'media') this.events.peerMedia({ mic: data.mic === true, camera: data.camera === true, translation: data.translation === true });
        else if (['chat', 'caption'].includes(data?.kind) && typeof data.text === 'string' && data.text.trim() && data.text.length <= 1000 && ['es', 'de'].includes(data.language)) this.events.message(data);
      } catch { /* Ignore malformed peer messages. */ }
    };
  }
  send(data) {
    if (this.channel?.readyState !== 'open' || this.channel.bufferedAmount > 65_536) return false;
    try { this.channel.send(JSON.stringify(data)); return true; } catch { return false; }
  }
  sendMediaState() {
    this.send({ kind: 'media', mic: this.tracks.has('audio'), camera: this.tracks.has('video'), translation: this.translation });
  }
  async setTranslation(allowed) {
    const client = this.client;
    if (!allowed) { this.translation = false; this.sendMediaState(); }
    await this.sendRequest('/consent', { allowed }, client);
    if (this.closed || this.client !== client) return;
    this.translation = allowed;
    this.sendMediaState();
  }
  async toggle(kind) {
    const current = this.tracks.get(kind);
    if (current) {
      this.tracks.delete(kind);
      current.stop();
      try { await this.transceivers?.[kind]?.sender.replaceTrack(null); } catch { /* The peer was closed concurrently. */ }
      this.events.local(this.tracks);
      this.sendMediaState();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Abre LingoLite en HTTPS o en localhost para activar tus dispositivos.');
    const stream = await navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: { echoCancellation: true, noiseSuppression: true }, video: false } : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const track = stream.getTracks()[0];
    if (this.closed) { track.stop(); return; }
    this.tracks.set(kind, track);
    track.onended = () => { if (this.tracks.get(kind) === track) this.toggle(kind); };
    try {
      await this.transceivers?.[kind]?.sender.replaceTrack(track);
    } catch (error) {
      this.tracks.delete(kind);
      track.stop();
      throw error;
    }
    this.events.local(this.tracks);
    this.sendMediaState();
  }
  stop() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    for (const track of this.tracks.values()) track.stop();
    this.tracks.clear();
    this.reset();
  }
  async leave() {
    this.stop();
    await this.sendRequest('/leave', {});
  }
}
