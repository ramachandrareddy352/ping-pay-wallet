// screens/ImportAccountScreen.tsx (Updated with Spinner Modal)
import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import bs58 from 'bs58';

import BackIcon from '../../assets/icons/back-arrow.svg';

import {importAccount, isDuplicateAccount} from '../../utils/wallet';
import {loadWallet, saveWallet, WalletData} from '../../utils/storage';

import {RootStackParamList} from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportAccount'>;

export default function ImportAccountScreen({navigation}: Props) {
  const [walletName, setWalletName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // State to manage loading

  function validateKey(input: string) {
    const text = input?.trim() ?? '';
    setPrivateKey(text);

    try {
      const decoded = bs58.decode(text);
      // Solana secret key length = 64 bytes OR 32 bytes seed
      if (decoded.length === 64 || decoded.length === 32) {
        setIsValid(true);
      } else {
        setIsValid(false);
      }
    } catch (e) {
      setIsValid(false);
    }
  }

  async function handleImport() {
    if (!isValid || !walletName) {
      console.log(
        '[Import] Invalid state: isValid=',
        isValid,
        ' walletName=',
        walletName,
      );
      return;
    }

    setIsLoading(true); // Start loading

    try {
      const newAcc = importAccount(privateKey, walletName);
      // check duplicates & derived conflicts
      const isDup = await isDuplicateAccount(newAcc.publicKey);

      if (isDup) {
        Toast.show({
          type: 'error',
          text1: 'This account already exists. Invalid Duplicate',
        });
        return;
      }

      let wallet = await loadWallet();

      if (!wallet) {
        wallet = {accounts: [], currentAccountId: null, network: 'devnet'};
      }

      const updated: WalletData = {
        ...wallet,
        accounts: [...wallet.accounts, newAcc],
        currentAccountId: newAcc.id,
      };

      await saveWallet(updated);
      Toast.show({
        type: 'success',
        text1: 'Account imported successfully',
      });
      // go back to Accounts screen
      navigation.navigate('Accounts');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Invalid private key.',
      });
    } finally {
      setIsLoading(false); // Stop loading regardless of success or failure
    }
  }

  function handlePaste() {
    Clipboard.getString()
      .then(text => {
        console.log('[Paste] clipboard text length', text?.length);
        validateKey(text);
      })
      .catch(e => {
        console.log('[Paste] clipboard error', e);
      });
  }

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Back Arrow and Title */}
      <View className="pb-3 mb-4">
        <Pressable
          onPress={() => navigation.navigate('Accounts')}
          className="flex flex-row items-center gap-4">
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">
            Import Private key
          </Text>
        </Pressable>
      </View>

      {/* Wallet Name */}
      <TextInput
        placeholder="Wallet Name"
        placeholderTextColor="#777"
        value={walletName}
        onChangeText={setWalletName}
        className="w-full border border-gray-700 rounded-xl px-4 py-3 text-white mb-4"
      />

      {/* Private Key */}
      <View className="w-full border border-gray-700 rounded-xl px-4 py-3 mb-6">
        <TextInput
          placeholder="Paste Private Key"
          placeholderTextColor="#777"
          value={privateKey}
          onChangeText={validateKey}
          multiline
          className="text-white h-20"
        />

        <TouchableOpacity
          onPress={handlePaste}
          className="flex flex-row justify-center items-center mt-2">
          <Text className="text-white Medium">📋 Paste</Text>
        </TouchableOpacity>
      </View>

      {/* Import Button */}
      <TouchableOpacity
        disabled={!isValid || !walletName}
        onPress={handleImport}
        className={`w-full py-3 px-6 rounded-full ${
          isValid && walletName ? 'bg-[#9707B5]' : 'bg-gray-700'
        }`}>
        <Text className="text-base font-semibold  text-center text-white">
          Import
        </Text>
      </TouchableOpacity>

      {/* Loading Modal */}
      <Modal
        transparent={true}
        visible={isLoading}
        animationType="fade"
        onRequestClose={() => {}}>
        <View className="flex-1 justify-center items-center">
          <View className=" p-6 rounded-xl">
            <ActivityIndicator size="large" color="#9707B5" />
          </View>
        </View>
      </Modal>
    </View>
  );
}
