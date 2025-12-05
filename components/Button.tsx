import {Text, TouchableOpacity} from 'react-native';

export default function Button({title, onPress}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-[#9707B5] p-4 rounded-2xl items-center">
      <Text className="text-white font-semibold text-lg">{title}</Text>
    </TouchableOpacity>
  );
}
