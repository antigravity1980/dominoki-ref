// Перенос данных с Netlify на свой сервер.
// Запуск из папки проекта:  node migrate.mjs https://ваш-сайт.netlify.app
// Переносит референсы, комментарии и все вложения в папку data/.
import { getStore } from './server/store.mjs';

const base = process.argv[2];
if (!base) {
  console.log('Использование: node migrate.mjs https://ваш-сайт.netlify.app');
  process.exit(1);
}

const store = getStore();
console.log('Читаю данные с', base, '...');

const r = await fetch(base + '/.netlify/functions/api');
if (!r.ok) {
  console.log('Ошибка: сервер вернул', r.status);
  process.exit(1);
}
const { refs } = await r.json();
console.log('Найдено референсов:', refs.length);

for (const ref of refs) {
  await store.setJSON('ref:' + ref.id, ref);
  console.log('  референс #' + ref.id, '- ' + (ref.title || '(без названия)'));
  for (const att of (ref.attachments || [])) {
    const m = await fetch(base + '/.netlify/functions/api?media=' + encodeURIComponent(att.id));
    if (!m.ok) {
      console.log('    ! вложение', att.id, '- ошибка', m.status);
      continue;
    }
    const buf = Buffer.from(await m.arrayBuffer());
    const ct = m.headers.get('content-type') || 'image/jpeg';
    await store.set('media:' + att.id, buf, { metadata: { contentType: ct } });
    console.log('    вложение', att.id, '-', buf.length, 'байт');
  }
}

if (refs.length) {
  await store.set('meta:seeded', '1');
}
console.log('Готово! Все данные сохранены в папку data/.');
