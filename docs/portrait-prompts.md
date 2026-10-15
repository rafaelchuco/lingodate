# Imágenes actuales y procedencia

Sofía utiliza `public/portraits/sofia.jpg`, procedente de la imagen aportada posteriormente por el usuario; sustituye al retrato de IA anterior, disponible en el historial de Git. Emma utiliza `public/portraits/emma-reference.jpg`, procedente de la primera imagen adjunta por el usuario. Lisa (antes Yuki) utiliza `public/portraits/lisa.jpg`, procedente de la segunda imagen adjunta. Se copiaron como JPEG sin cambiar su contenido. No se afirma la identidad, nacionalidad, participación ni respaldo de las personas de estas fotos. La información de los personajes es ficticia. Los retratos generados anteriores de Emma y Yuki se conservan como recursos históricos y ya no se usan en sus perfiles.

## Historial de los retratos generados

Los retratos de Sofía, Lucas, Yuki y Emma fueron generados con la herramienta integrada Imagegen. Representan adultos ficticios; sus nombres, países, biografías y preferencias forman parte de personajes de demostración. No se atribuye ninguna nacionalidad ni participación en una aplicación de citas a personas reales. La foto previa de Kasia se conserva del repositorio original.

Archivos finales: `public/portraits/sofia.jpg`, `lucas.jpg`, `yuki.jpg`, `emma.jpg`. Los PNG originales permanecen en la carpeta de generación local; las copias JPEG se optimizaron para servirlas desde el propio proyecto. No se realizan peticiones a bancos de imágenes desde el navegador.

## Prompts de generación

Se utilizó este marco común en una llamada independiente por personaje:

> Use case: photorealistic-natural. Asset: single portrait for an explicitly fictional dating app demo character. Subject: [descripción del personaje]. Portrait orientation 4:5 or 2:3, one person only, head and upper torso, eyes to camera, full head with generous space above and shoulders fully within frame, realistic skin texture and candid lifestyle photography, warm soft late afternoon daylight, editorial 85mm portrait lens. Beautiful but believable, natural healthy appearance, tasteful everyday clothing. No text, logo, border, watermark, collage or UI. Entirely invented person, not a real individual.

**Sofía:** Sofía, a fictional 24-year-old adult Peruvian woman living in Lima. Long dark brown hair, warm medium complexion, lovely natural smile, contemporary casual cream blouse, Miraflores seaside park softly blurred behind her, attractive and approachable.

**Lucas:** Lucas, a fictional 28-year-old adult Brazilian man living in São Paulo. Short dark curly hair, warm brown skin, neat short beard, charming relaxed smile, casual olive linen shirt, leafy city cafe softly blurred behind him, handsome and approachable.

**Yuki:** Yuki, a fictional 26-year-old adult Japanese woman living in Kyoto. Shoulder-length black hair, soft fringe, lovely natural smile, contemporary light blue casual blouse, quiet leafy Kyoto street softly blurred behind her, attractive and approachable. No costume.

**Emma:** Emma, a fictional 27-year-old adult French woman living in Paris. Wavy chestnut brown shoulder-length hair, light freckles, lovely natural smile, simple cream knit top, Parisian cafe street softly blurred behind her, attractive and approachable. No beret.

## Álex

Archivo final: `public/portraits/alex.jpg`. Generado con Imagegen integrado; JPEG optimizado a partir del PNG original conservado en la carpeta local de generación.

> Use case: photorealistic-natural. Asset: single portrait for explicitly fictional dating app character Álex, a handsome 29-year-old adult American man living in New York. Short dark blond slightly wavy hair, subtle stubble, kind natural smile, contemporary navy casual overshirt, tree-lined Brooklyn street softly blurred in the background. One invented person only, no resemblance to a named real individual. Portrait orientation 4:5, head and upper torso, full head with generous space above, shoulders in frame, realistic skin texture, warm soft afternoon daylight, editorial candid 85mm portrait photography. Charming and approachable, tasteful everyday clothing. No text, logo, border, watermark, collage or UI.
