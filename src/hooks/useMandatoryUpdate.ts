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
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const currentVersion = DeviceInfo.getVersion();

        const { data } = await axios.get<{
          success: boolean;
          body?: VersionInfo;
        }>('https://api-platform.pingpay.info/public/open/update-info');

        const info = data.body;
        if (!info) {
          setLoading(false);
          return;
        }

        setVersionInfo(info);
        setUpdateMessage(info.message);

        if (isVersionOlder(currentVersion, info.minVersion)) {
          // ❗ Instead of auto updating, just mark mandatory=true
          setIsMandatory(true);
        } else {
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
