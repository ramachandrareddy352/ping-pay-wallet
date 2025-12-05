import React from 'react';
import { View, Text, TouchableOpacity, Linking, Image } from 'react-native';
import { VersionInfo } from '../../src/hooks/useMandatoryUpdate';
import Toast from 'react-native-toast-message';

export default function UpdateRequiredScreen({
  message,
  versionInfo,
}: {
  message: string;
  versionInfo: VersionInfo;
}) {
  const handleUpdate = async () => {
    if (await Linking.canOpenURL(versionInfo.appleStoreUrl)) {
      console.log('class');
      Linking.openURL(versionInfo.appleStoreUrl);
    } else {
      Toast.show({ type: 'error', text1: 'Can not able to open the link' });
    }
  };

  return (
    <View className="flex-1 bg-black items-center pt-20">
      <Image
        source={require('../../assets/images/ping-pay-icon.png')}
        style={{ width: 80, height: 80, marginBottom: 5 }}
      />
      <Text className="text-white mb-20">
        Pin Pay - v{versionInfo.minVersion}
      </Text>
      <View className="justify-center p-8">
        <Text className="text-white text-2xl font-bold mb-4">
          Update Required
        </Text>
        <Text className="text-gray-300 text-center mb-8">{message}</Text>
        <TouchableOpacity
          onPress={handleUpdate}
          className="bg-purple-600 px-8 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold text-lg">Update Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
