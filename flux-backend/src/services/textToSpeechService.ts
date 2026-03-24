import textToSpeech, { protos, TextToSpeechClient } from '@google-cloud/text-to-speech';

class TextToSpeechService {
  private client: TextToSpeechClient;

  constructor() {
    this.client = new textToSpeech.TextToSpeechClient();
  }

  async synthesizeSpeech(
    text: string,
    languageCode: string = 'es-ES',
    voiceName?: string
  ): Promise<Buffer> {
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName || 'es-ES-Neural2-A', // Voz femenina neural española
        ssmlGender: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.FEMALE,
      },
      audioConfig: {
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
        speakingRate: 1.0,
        pitch: 0,
        volumeGainDb: 0,
        effectsProfileId: ['headphone-class-device'],
      },
    };

    try {
      const [response] = await this.client.synthesizeSpeech(request);
      
      if (!response.audioContent) {
        throw new Error('No audio content received');
      }

      return Buffer.from(response.audioContent as Uint8Array);
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  async getAvailableVoices(languageCode: string = 'es-ES') {
    try {
      const [response] = await this.client.listVoices({ languageCode });
      return response.voices?.map(voice => ({
        name: voice.name,
        gender: voice.ssmlGender,
        languageCodes: voice.languageCodes,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
      }));
    } catch (error) {
      console.error('Error getting voices:', error);
      throw error;
    }
  }
}

export const textToSpeechService = new TextToSpeechService();