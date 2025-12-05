import { useEffect, useState } from 'react';
import { Platform, Linking } from 'react-native';
import InAppUpdates, {
  IAUUpdateKind,
  StartUpdateOptions,
} from 'sp-react-native-in-app-updates';
import DeviceInfo from 'react-native-device-info';
import axios from 'axios';

export interface VersionInfo {
  minVersion: string;
  message: string;
  playStoreUrl: string;
  appleStoreUrl: string;
}

export const useMandatoryUpdate = () => {
  const [isMandatory, setIsMandatory] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    minVersion: '2.0',
    message: 'It is mandatatory to update',
    playStoreUrl: 'Play store url',
    appleStoreUrl: 'apple store url',
  });

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        // 1. Get current version
        const currentVersion = DeviceInfo.getVersion(); // e.g. "0.0.1"
        console.log('currentVersion: ', currentVersion);

        // 2. Fetch version info from your API
        const { data } = await axios.get<{
          success: boolean;
          body?: VersionInfo;
        }>('https://api-platform.pingpay.info/public/open/update-info');

        const info = data.body;
        // const info = {
        //   minVersion: '1.1',
        //   message: 'It is mandatatory to update',
        //   playStoreUrl: 'Play store url',
        //   appleStoreUrl: 'apple store url',
        // };
        if (!info) {
          setLoading(false);
          return;
        }

        setVersionInfo(info);
        setUpdateMessage(info.message);

        // 3. Compare versions
        if (isVersionOlder(currentVersion, info.minVersion)) {
          setIsMandatory(true);
          // Immediately start update for Android
          if (Platform.OS === 'android') {
            const inAppUpdates = new InAppUpdates(false);
            const updateOptions: StartUpdateOptions = {
              updateType: IAUUpdateKind.IMMEDIATE, // blocks the app until update done
            };
            try {
              await inAppUpdates.startUpdate(updateOptions);
            } catch (err) {
              console.log('In-app update failed', err);
              // fallback: open Play Store manually
              Linking.openURL(info.playStoreUrl);
            }
          } else {
            // On iOS, open App Store link
            Linking.openURL(info.appleStoreUrl);
          }
        } else {
          // Version is okay
          setIsMandatory(false);
        }
      } catch (e) {
        console.warn('Version check failed:', e);
      } finally {
        setLoading(false);
      }
    };

    checkUpdate();
  }, []);

  return { isMandatory, updateMessage, loading, versionInfo };
};

// Compare semantic versions (simple)
function isVersionOlder(current: string, min: string): boolean {
  const c = current.split('.').map(Number);
  const m = min.split('.').map(Number);
  for (let i = 0; i < m.length; i++) {
    if ((c[i] || 0) < (m[i] || 0)) return true;
    if ((c[i] || 0) > (m[i] || 0)) return false;
  }
  return false;
}
