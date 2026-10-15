// Authored examples for fictional demo conversations. Pronunciation is approximate for Spanish readers.
const examples = {
  Polaco: [
    ['Cześć! Miło cię poznać. Co lubisz w swoim mieście?', 'Chéshch! Míwo che poznach. Tso lúbish f svoim miéshche?', '¡Hola! Me alegra conocerte. ¿Qué te gusta de tu ciudad?'],
    ['Uwielbiam poznawać nowe kultury! Opowiedz mi o sobie.', 'Uviélbiam poznávach nóve kultúry! Opóviech mi o sóbie.', '¡Me encanta conocer nuevas culturas! Cuéntame sobre ti.'],
    ['Kawa i dobra rozmowa to świetny pomysł.', 'Káva i dóbra rozmóva to shviétny pómisw.', 'Un café y una buena conversación son una gran idea.'],
    ['Jakie miejsce w twoim kraju polecasz odwiedzić?', 'Yákie miéistse f tvóim kráyu polétsash odviédjich?', '¿Qué lugar de tu país me recomiendas visitar?']
  ],
  Portugués: [
    ['Oi! Que bom te conhecer. O que você mais gosta na sua cidade?', 'Oi! Ke bom chi koñesér. U ke vosé mais gósta na súa sidáyi?', '¡Hola! Qué bueno conocerte. ¿Qué es lo que más te gusta de tu ciudad?'],
    ['Adoro conhecer novas culturas! Me conta mais sobre você.', 'Adóru koñesér nóvas kultúras! Mi kónta mais sóbri vosé.', '¡Me encanta conocer nuevas culturas! Cuéntame más sobre ti.'],
    ['Um café e uma boa conversa parecem um ótimo plano.', 'Um kafé i úma bóa konvérsa parésem um ótchimu plánu.', 'Un café y una buena conversación parecen un gran plan.'],
    ['Que lugar do seu país você me recomenda visitar?', 'Ke lugár du séu país vosé mi rekoménda vizitár?', '¿Qué lugar de tu país me recomiendas visitar?']
  ],
  Japonés: [
    ['こんにちは！会えてうれしいです。あなたの街の好きなところは？', 'Kon-nichiwá! Aéte ureshíi des. Anáta no máchi no sukí na tokóro wa?', '¡Hola! Me alegra conocerte. ¿Qué es lo que más te gusta de tu ciudad?'],
    ['いろいろな文化を知るのが好きです。あなたのことをもっと教えてください。', 'Iróiro na bunka o shirú no ga sukí des. Anáta no kóto o motto oshíete kudasái.', 'Me gusta conocer diferentes culturas. Cuéntame más sobre ti.'],
    ['コーヒーを飲みながらお話ししたいです。', 'Koohíi o nomínagara ohánashi shitái des.', 'Me gustaría conversar mientras tomamos un café.'],
    ['あなたの国でおすすめの場所はどこですか？', 'Anáta no kúni de osusumé no básho wa dóko des ka?', '¿Qué lugar de tu país me recomiendas visitar?']
  ],
  Francés: [
    ['Salut ! Ravie de te rencontrer. Qu’est-ce que tu aimes dans ta ville ?', 'Salú! Raví de te rankontré. Kes ke tu em dan ta vil?', '¡Hola! Encantada de conocerte. ¿Qué te gusta de tu ciudad?'],
    ['J’adore découvrir de nouvelles cultures ! Parle-moi de toi.', 'Yadór dekuvrír de nuvél kultúr! Parl muá de tuá.', '¡Me encanta descubrir nuevas culturas! Háblame de ti.'],
    ['Un café et une bonne conversation, ça me plaît.', 'An kafé e un bon konversasión, sa me ple.', 'Un café y una buena conversación, me gusta la idea.'],
    ['Quel endroit de ton pays me conseilles-tu de visiter ?', 'Kel andruá de ton peí me konséi tu de vizité?', '¿Qué lugar de tu país me recomiendas visitar?']
  ],
  Inglés: [
    ['Hi! It’s nice to meet you. What do you love about your city?', 'Jái! Its náis tu mít iu. Uat du iu lov abáut ior síti?', '¡Hola! Qué gusto conocerte. ¿Qué te encanta de tu ciudad?'],
    ['I love learning about new cultures! Tell me more about yourself.', 'Ai lov lérning abáut niu kólchurs! Tel mi mor abáut iorsélf.', '¡Me encanta aprender sobre nuevas culturas! Cuéntame más sobre ti.'],
    ['Coffee and a good conversation sound like a great plan.', 'Kófi and a gud konverséishon sáund laik a greit plan.', 'Un café y una buena conversación suenan como un gran plan.'],
    ['What place in your country would you recommend visiting?', 'Uat pléis in ior kóntri wud iu rekoménd vísiting?', '¿Qué lugar de tu país me recomendarías visitar?']
  ],
  Español: [
    ['¡Hola! Qué bueno conocerte. ¿Qué te gusta de tu ciudad?', 'Hola, qué bueno conocerte. ¿Qué te gusta de tu ciudad?', '¡Hola! Qué bueno conocerte. ¿Qué te gusta de tu ciudad?'],
    ['¡Me encanta conocer nuevas culturas! Cuéntame más sobre ti.', 'Me encanta conocer nuevas culturas. Cuéntame más sobre ti.', '¡Me encanta conocer nuevas culturas! Cuéntame más sobre ti.'],
    ['Un café y una buena conversación suenan como un gran plan.', 'Un café y una buena conversación suenan como un gran plan.', 'Un café y una buena conversación suenan como un gran plan.'],
    ['¿Qué lugar de tu país me recomiendas visitar?', 'Qué lugar de tu país me recomiendas visitar.', '¿Qué lugar de tu país me recomiendas visitar?']
  ]
};
export function demoPhrase(language, index = 0) {
  const phrases = examples[language];
  if (!phrases) return null;
  const [original, pronunciation, translation] = phrases[index % phrases.length];
  return { original, pronunciation, translation, sourceLanguage: language };
}
export function findDemoPhrase(language, text) {
  return examples[language]?.map((_, index) => demoPhrase(language, index)).find(p => p.original === text) || null;
}
