module.exports = {
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
  azureOpenAIAPIKey: process.env.AZURE_OPENAI_API_KEY || '',
  azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini',
  azureOpenAIAPIVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
  azureSpeechKey: process.env.AZURE_SPEECH_KEY || '',
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION || '',
  azureSpeechEndpoint: process.env.AZURE_SPEECH_ENDPOINT || '',
}
