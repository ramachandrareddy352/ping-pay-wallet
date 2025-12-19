import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

export type BiometricType = keyof typeof BiometryTypes | null;

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export const checkBiometricsAvailability = async (): Promise<BiometricType> => {
    try {
        const { available, biometryType } = await rnBiometrics.isSensorAvailable();

        if (available && biometryType) {
            return biometryType as keyof typeof BiometryTypes;
        }

        return null;
    } catch (error) {
        console.error('Biometrics availability check failed:', error);
        return null;
    }
};


export const authenticateWithBiometrics = async (reason: string = 'Unlock your wallet'): Promise<boolean> => {
    try {
        const { success } = await rnBiometrics.simplePrompt({
            promptMessage: reason,
            cancelButtonText: 'Cancel',
            fallbackPromptMessage: 'Use PIN instead',  // Optional: Shows PIN fallback label
        });
        return success;
    } catch (error) {
        console.error('Biometric auth failed:', error);
        return false;
    }
};