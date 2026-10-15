// Text/chat models verified against Google's catalog on 2026-10-15.
// https://ai.google.dev/gemini-api/docs/models
// Discovery is available without a connected proxy; actual access depends on
// the Google account used by the proxy. Live, image, TTS and embedding models
// require different request/response handling and are not advertised for chat.
const chatModels = [
    { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon' },
    { id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.6-flash', displayName: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite' },
    { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-3.1-pro-preview-customtools', displayName: 'Gemini 3.1 Pro Preview Custom Tools' },
    { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash-Lite' },
    { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite' },
];

export function listOpenAIModels() {
    return {
        object: 'list',
        data: chatModels.map(({ id }) => ({
            id,
            object: 'model',
            created: 0, // Creation timestamps are not published by models.list.
            owned_by: 'google',
        })),
    };
}

export function listGeminiModels() {
    return {
        models: chatModels.map(({ id, displayName }) => ({
            name: `models/${id}`,
            displayName,
            inputTokenLimit: 1048576,
            outputTokenLimit: 65536,
            supportedGenerationMethods: ['generateContent', 'streamGenerateContent', 'countTokens'],
        })),
    };
}
