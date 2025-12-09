import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  BackHandler,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { VersionInfo } from '../../src/hooks/useMandatoryUpdate';
import InAppUpdates, {
  IAUUpdateKind,
  AndroidInstallStatus,
} from 'sp-react-native-in-app-updates';
import Toast from 'react-native-toast-message';

export default function UpdateRequiredScreen({
  message,
  versionInfo,
}: {
  message: string;
  versionInfo: VersionInfo;
}) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0); // percent
  const [bytesDownloaded, setBytesDownloaded] = useState(0);

  const inAppUpdates = new InAppUpdates(false);

  const startFlexibleUpdate = async () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(versionInfo.appleStoreUrl);
      return;
    }

    try {
      setDownloading(true);

      // Listen to progress updates
      inAppUpdates.addStatusUpdateListener(status => {
        if (status.status === AndroidInstallStatus.DOWNLOADING) {
          const bytes = status.bytesDownloaded;
          const total = status.totalBytesToDownload;

          const p = Math.floor((bytes / total) * 100);

          setProgress(p);
          setBytesDownloaded(bytes);
        }

        if (status.status === AndroidInstallStatus.DOWNLOADED) {
          // Apply update automatically
          inAppUpdates.installUpdate();
        }
      });

      await inAppUpdates.startUpdate({
        updateType: IAUUpdateKind.FLEXIBLE,
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Update failed' });
      setDownloading(false);
    }
  };

  const closeApp = () => {
    BackHandler.exitApp();
  };

  const bytesToMB = (b: number) => (b / (1024 * 1024)).toFixed(2);

  if (downloading) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Text className="text-white text-lg font-semibold mb-4">
          Downloading Update…
        </Text>

        <Text className="text-gray-300 mb-2">
          Downloaded: {bytesToMB(bytesDownloaded)} MB
        </Text>

        <Text className="text-purple-400 font-bold text-2xl mb-4">
          {progress}%
        </Text>

        <ActivityIndicator color="#a855f7" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black items-center justify-center px-10">
      <Image
        source={require('../../assets/images/ping-pay-icon.png')}
        style={{ width: 80, height: 80 }}
        className="mb-6"
      />

      <Text className="text-white mb-5 text-2xl">⚠️ Update Required</Text>

      <Text className="text-gray-300 text-center mb-20">{message}</Text>

      {/* UPDATE BUTTON */}
      <TouchableOpacity
        onPress={startFlexibleUpdate}
        className="bg-purple-600 px-8 py-3 rounded-xl w-full mb-6"
      >
        <Text className="text-white font-semibold text-lg text-center">
          Update App 🚀
        </Text>
      </TouchableOpacity>

      {/* CLOSE APP BUTTON */}
      <TouchableOpacity
        onPress={closeApp}
        style={{
          paddingVertical: 12,
          borderRadius: 12,
          width: '100%',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
        }}
      >
        <Text className="text-gray-300 font-semibold text-lg text-center">
          Close App 🛑
        </Text>
      </TouchableOpacity>
    </View>
  );
}
