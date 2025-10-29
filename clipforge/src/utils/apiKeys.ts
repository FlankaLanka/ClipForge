/**
 * API Key management utilities
 */

export interface ApiKeyStatus {
  isValid: boolean;
  error?: string;
}

/**
 * Get OpenAI API key from environment variable
 * In Tauri, environment variables are passed through the backend
 */
export const getOpenAIApiKey = async (): Promise<string | null> => {
  try {
    // In Tauri, we need to get the API key from the backend
    // This will be implemented as a Tauri command
    const { invoke } = await import('@tauri-apps/api/core');
    const apiKey = await invoke<string>('get_openai_api_key');
    return apiKey || null;
  } catch (error) {
    console.error('Failed to get OpenAI API key:', error);
    return null;
  }
};

/**
 * Validate OpenAI API key format
 */
export const validateOpenAIKey = (key: string | null): ApiKeyStatus => {
  if (!key) {
    return {
      isValid: false,
      error: 'OpenAI API key not found. Please set OPENAI_API_KEY environment variable.'
    };
  }

  if (!key.startsWith('sk-')) {
    return {
      isValid: false,
      error: 'Invalid OpenAI API key format. Key should start with "sk-".'
    };
  }

  if (key.length < 20) {
    return {
      isValid: false,
      error: 'Invalid OpenAI API key format. Key appears to be too short.'
    };
  }

  return {
    isValid: true
  };
};

/**
 * Check if OpenAI API key is available and valid
 */
export const checkOpenAIKeyStatus = async (): Promise<ApiKeyStatus> => {
  const apiKey = await getOpenAIApiKey();
  return validateOpenAIKey(apiKey);
};

/**
 * Get error message for missing API key
 */
export const getApiKeyErrorMessage = (): string => {
  return 'OpenAI API key is required for AI features. Please set up your API key using one of these methods:\n\n1. Create a .env file with OPENAI_API_KEY=your-key-here\n2. Set the environment variable: export OPENAI_API_KEY="your-key-here"\n\nThen restart the application.';
};

/**
 * Get setup instructions for API key
 */
export const getApiKeySetupInstructions = (): string[] => {
  return [
    '1. Get your OpenAI API key from https://platform.openai.com/api-keys',
    '2. Copy .env.example to .env: cp .env.example .env',
    '3. Edit .env and add your API key: OPENAI_API_KEY=sk-your-key-here',
    '4. Restart ClipForge',
    '5. The AI Tools tab will be available once the key is set'
  ];
};
