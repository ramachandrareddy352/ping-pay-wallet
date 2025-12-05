import React from 'react';
import {ActivityIndicator, View} from 'react-native';

export default function Spinner() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}
