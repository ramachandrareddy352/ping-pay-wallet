import React from 'react';
import {View, Text, Pressable} from 'react-native';
// Icons
import EyeShowIcon from '../assets/icons/Eye-Show-icon.svg';
import HideCodeIcon from '../assets/icons/Hidecode-icon.svg';
import BackspaceIcon from '../assets/icons/backspace-icon.svg';

interface KeypadProps {
  codeLength: number;
  showCode: boolean;
  handlePress: (num: string) => void;
  handleBackspace: () => void;
  toggleShowCode: () => void;
}

const Keypad: React.FC<KeypadProps> = ({
  codeLength,
  showCode,
  handlePress,
  handleBackspace,
  toggleShowCode,
}) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const KeypadButton: React.FC<{
    digit: string;
    onPress: () => void;
    disabled: boolean;
  }> = ({digit, onPress, disabled}) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-600">
      <Text className="text-white text-xl SemiBold">{digit}</Text>
    </Pressable>
  );

  return (
    <View className="w-full px-4 pb-4">
      {/* Row 1-3 (Digits 1-9) */}
      {[0, 3, 6].map(startIndex => (
        <View key={startIndex} className="flex flex-row justify-between mb-4">
          {digits.slice(startIndex, startIndex + 3).map(d => (
            <KeypadButton
              key={d}
              digit={d}
              onPress={() => handlePress(d)}
              disabled={codeLength >= 6}
            />
          ))}
        </View>
      ))}

      {/* Bottom row: show/hide, 0, backspace */}
      <View className="flex flex-row justify-between">
        {/* Show/Hide Toggle */}
        <Pressable
          onPress={toggleShowCode}
          className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center active:bg-gray-700">
          {showCode ? (
            <HideCodeIcon width={28} height={28} />
          ) : (
            <EyeShowIcon width={28} height={28} />
          )}
        </Pressable>

        {/* Digit 0 */}
        <KeypadButton
          digit="0"
          onPress={() => handlePress('0')}
          disabled={codeLength >= 6}
        />

        {/* Backspace */}
        <Pressable
          onPress={handleBackspace}
          disabled={codeLength === 0}
          className="w-20 h-20 bg-[#12151E] rounded-full flex items-center justify-center disabled:opacity-50 active:bg-gray-700">
          <BackspaceIcon width={30} height={20} />
        </Pressable>
      </View>
    </View>
  );
};

export default Keypad;
