export default async (req) => {
if (req.method !== 'POST') { return new Response(JSON.stringify({ error: 'Method
not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' }
}); } const apiKey = process.env.GROQ_API_KEY || (typeof Netlify !== 'undefined'
? Netlify.env.get('GROQ_API_KEY') : ''); if (!apiKey) { return new
Response(JSON.stringify({ error: 'Нет ключа GROQ_API_KEY в настройках Netlify'
}), { status: 500, headers: { 'Content-Type': 'application/json' } }); } try {
const incoming = await req.formData(); const audioFile = incoming.get('file');
if (!audioFile || typeof audioFile === 'string') { return new
Response(JSON.stringify({ error: 'Аудиофайл не получен' }), { status: 400,
headers: { 'Content-Type': 'application/json' } }); } const arrayBuffer = await
audioFile.arrayBuffer(); if (arrayBuffer.byteLength < 500) { return new
Response(JSON.stringify({ text: '' }), { status: 200, headers: { 'Content-Type':
'application/json' } }); } const fileName = audioFile.name || 'voice.webm';
const rawType = (audioFile.type || 'audio/webm').split(';')[0]; const blob = new
Blob([arrayBuffer], { type: rawType }); const groqForm = new FormData();
groqForm.append('file', blob, fileName); groqForm.append('model',
'whisper-large-v3-turbo'); groqForm.append('language', 'ru');
groqForm.append('response_format', 'json'); const groqRes = await
fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST',
headers: { Authorization: 'Bearer ' + apiKey }, body: groqForm }); const data =
await groqRes.json(); if (!groqRes.ok) { return new Response(JSON.stringify({
error: (data.error && data.error.message) || 'Ошибка Groq API' }), { status:
groqRes.status, headers: { 'Content-Type': 'application/json' } }); } return new
Response(JSON.stringify({ text: (data.text || '').trim() }), { status: 200,
headers: { 'Content-Type': 'application/json' } }); } catch (err) { return new
Response(JSON.stringify({ error: err.message || 'Ошибка сервера' }), {
status: 500, headers: { 'Content-Type': 'application/json' } }); } };