import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import BackIcon from '../../assets/icons/back-arrow.svg';
import CloseIcon from '../../assets/icons/close-icon.svg';

import { RootStackParamList } from '../../types/navigation';

import { loadWallet, saveWallet, WalletAccount } from '../../utils/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountName'>;

const AccountNameScreen = ({ route, navigation }: Props) => {
  const { accountId, currentName } = route.params;

  const [name, setName] = useState(currentName);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name cannot be empty.' });
      return;
    }

    if (name.trim().length > 15) {
      Toast.show({
        type: 'error',
        text1: 'Name cannot exceed 15 characters.',
      });
      return;
    }

    try {
      setLoading(true);
      const wallet = await loadWallet();
      if (wallet) {
        const updatedAccounts = wallet.accounts.map((a: WalletAccount) =>
          a.id === accountId ? { ...a, name: name.trim() } : a,
        );
        await saveWallet({ ...wallet, accounts: updatedAccounts });
        Toast.show({
          type: 'success',
          text1: 'Account name updated successfully',
        });
        navigation.navigate('EditAccount', { accountId });
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Failed to update account name.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isSaveDisabled =
    !name.trim() || name.trim() === currentName.trim() || loading;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity
          onPress={() => navigation.navigate('EditAccount', { accountId })}
        >
          <BackIcon width={18} height={18} />
        </TouchableOpacity>
        <Text className="text-white text-base Medium ml-4 flex-1">
          Account Name
        </Text>
      </View>

      {/* Input Section */}
      <View className="flex-row items-center justify-between mx-2 px-2 pt-2">
        {/* Text input + clear icon */}
        <View className="flex-1 flex-row items-center border-2 border-white px-4 rounded-xl">
          <TextInput
            value={name}
            onChangeText={setName}
            className="flex-1 text-white Medium text-base"
            placeholder="Enter account name"
            placeholderTextColor="#888"
            maxLength={50}
            autoFocus
          />
          {name.length > 0 && (
            <TouchableOpacity onPress={() => setName('')}>
              <CloseIcon width={16} height={16} />
            </TouchableOpacity>
          )}
        </View>

        {/* Cancel text */}
        <TouchableOpacity
          onPress={() => {
            setName(currentName);
            navigation.navigate('EditAccount', { accountId });
          }}
          className="ml-3"
        >
          <Text className="text-gray-400 text-sm Medium">Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <View
        className="absolute bottom-4 left-0 right-0 px-4"
        style={{
          marginBottom: isKeyboardVisible ? 20 : 0,
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaveDisabled}
          className={`w-full py-3 rounded-2xl ${
            isSaveDisabled ? 'bg-gray-700' : 'bg-[#9707B5]'
          }`}
        >
          <Text className="text-center text-white Medium text-base">Save</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default AccountNameScreen;
