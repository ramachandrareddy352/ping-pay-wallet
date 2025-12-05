import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { RootStackParamList } from '../../types/navigation';

import {
  loadWallet,
  saveWallet,
  WalletData,
  WalletAccount,
} from '../../utils/storage';
import {
  loadDerivedAccounts,
  loadImportedAccounts,
  addDerivedAccount,
  loadMnemonic,
} from '../../utils/wallet';

import BackIcon from '../../assets/icons/back-arrow.svg';
import SettingsIcon from '../../assets/icons/setting.svg';
import EditProfileIcon from '../../assets/icons/edit-profile-icon.svg';
import UsernameFrame from '../../assets/images/user-logo.png';

type Props = NativeStackScreenProps<RootStackParamList, 'Accounts'>;

export default function AccountsScreen({ navigation }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [derived, setDerived] = useState<WalletAccount[]>([]);
  const [imported, setImported] = useState<WalletAccount[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const isFocused = useIsFocused();

  const loadData = async () => {
    let data = await loadWallet();

    // initialize wallet if empty
    if (!data) {
      setIsCreating(true);
      const mnemonic = await loadMnemonic();
      if (!mnemonic) {
        Toast.show({
          type: 'error',
          text1: 'Mnemonic key not found',
        });
        return;
      }
      const first = await addDerivedAccount(mnemonic, 0);

      const firstWallet: WalletAccount = {
        id: first.publicKey,
        name: 'Account 1',
        publicKey: first.publicKey,
        secretKey: first.secretKey,
        type: 'derived',
        index: 0, // Explicitly set
      };

      data = {
        accounts: [firstWallet],
        currentAccountId: firstWallet.id,
        network: 'devnet',
        nextDerivedIndex: 1, // Next will be index 1
      };
      await saveWallet(data);
      setIsCreating(false);

      Toast.show({
        type: 'success',
        text1: 'Account created successfully',
      });
    }

    setWallet(data);

    // load sections
    const d = await loadDerivedAccounts();
    const i = await loadImportedAccounts();
    setDerived(data.accounts.filter(a => a.type === 'derived') || d || []);
    setImported(data.accounts.filter(a => a.type === 'imported') || i || []);
  };

  useEffect(() => {
    loadData();
  }, [isFocused]);

  async function handleCreate() {
    if (!wallet) return;
    setIsCreating(true);
    try {
      const mnemonic = await loadMnemonic();
      if (!mnemonic) {
        Toast.show({
          type: 'error',
          text1: 'Mnemonic key not found',
        });
        return;
      }

      // Use tracked next index (avoids reuse after delete)
      const nextIndex = wallet.nextDerivedIndex || derived.length;
      const acc = await addDerivedAccount(mnemonic, nextIndex);

      const newAcc: WalletAccount = {
        id: acc.publicKey,
        name: `Account ${
          wallet.nextDerivedIndex ? wallet.nextDerivedIndex + 1 : ''
        }`,
        publicKey: acc.publicKey,
        secretKey: acc.secretKey,
        type: 'derived',
        index: nextIndex, // Set the used index
      };

      const updated: WalletData = {
        ...wallet,
        accounts: [...wallet.accounts, newAcc],
        currentAccountId: newAcc.id,
        nextDerivedIndex: (wallet.nextDerivedIndex || 0) + 1, // Increment for next time
      };
      await saveWallet(updated);
      setWallet(updated);
      setDerived([...derived, newAcc]);

      Toast.show({
        type: 'success',
        text1: 'Account created successfully',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to create account',
      });
    } finally {
      setIsCreating(false);
    }
  }

  function selectAccount(id: string) {
    if (!wallet) return;
    const updated: WalletData = { ...wallet, currentAccountId: id };
    saveWallet(updated);
    setWallet(updated);
  }

  const renderAccount = (acc: WalletAccount, isDefault: boolean) => (
    <TouchableOpacity
      key={acc.id}
      onPress={() => selectAccount(acc.id)}
      className={`w-full relative rounded-xl border-2 ${
        isDefault ? 'border-primary' : ' bg-slate-950'
      } flex flex-row items-center justify-between px-3 py-4 mb-3`}
    >
      {isDefault && (
        <Text className=" bg-primary text-xs left-0 font-semibold rounded-tl-md rounded-br-2xl text-white px-3 absolute top-0">
          CURRENT
        </Text>
      )}

      {/* Avatar */}
      <View className="flex flex-row items-center gap-2">
        <View className="relative w-9 h-9 rounded-full overflow-hidden">
          {acc.imageUri ? (
            <Image
              source={{ uri: acc.imageUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Image
              source={UsernameFrame}
              className="w-full h-full absolute"
              resizeMode="cover"
            />
          )}
        </View>

        <View>
          <Text className=" text-base text-white">{acc.name}</Text>
          <Text className=" text-sm text-gray-400" numberOfLines={1}>
            {acc.publicKey.slice(0, 6)} ****** {acc.publicKey.slice(-6)}
          </Text>
        </View>
      </View>

      {/* Edit */}
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('EditAccount', { accountId: acc.id })
        }
        className="p-2"
      >
        <EditProfileIcon width={18} height={18} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isCreating) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#9707B5" />
        <Text className="text-white mt-4">
          Creating account, please wait...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black px-4">
      {/* Header */}
      <View className="pb-3 mb-2 pt-6 flex-row justify-between items-center">
        <Pressable
          onPress={() => navigation.navigate('Home')}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Your Accounts</Text>
        </Pressable>

        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <SettingsIcon width={26} height={26} />
        </TouchableOpacity>
      </View>

      {/* Accounts List */}
      <ScrollView className="flex-1 w-full">
        {/* Derived Section */}
        {derived.length > 0 && (
          <View className="">
            <Text className=" text-gray-400 mb-2 text-sm">Accounts</Text>
            {derived.map(acc =>
              renderAccount(
                wallet?.currentAccountId === acc.id ? acc : acc,
                wallet?.currentAccountId === acc.id,
              ),
            )}
          </View>
        )}

        {/* Imported Section */}
        {imported.length > 0 && (
          <View>
            <Text className=" text-gray-400 mb-2 text-sm">
              Imported Accounts
            </Text>
            {imported.map(acc =>
              renderAccount(
                wallet?.currentAccountId === acc.id ? acc : acc,
                wallet?.currentAccountId === acc.id,
              ),
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer Buttons */}
      <View className="flex flex-col mb-1 gap-2 mt-4">
        <TouchableOpacity
          onPress={handleCreate}
          className="w-full py-3 px-6 bg-primary  rounded-full"
          disabled={isCreating}
        >
          <Text className=" text-base font-semibold  text-center text-white">
            Create New Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('ImportAccount')}
          className="w-full py-3 px-6 bg-gray-700 rounded-full"
        >
          <Text className=" text-base font-semibold  text-center text-white">
            Import Account
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
