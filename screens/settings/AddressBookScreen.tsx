import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

import {RootStackParamList} from '../../types/navigation';
import {AddressEntry} from '../../types/dataTypes';

import {loadAddressBook, addAddress, deleteAddress} from '../../utils/storage';
import {validateSolanaAddress} from '../../utils/helper';

import BackIcon from '../../assets/icons/back-arrow.svg';
import DeleteIcon from '../../assets/icons/delete-icon.svg';
import CopyIcon from '../../assets/icons/copy-white.svg';
import UserIcon from '../../assets/icons/user-icon.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressBook'>;

const AddressBookScreen = ({navigation}: Props) => {
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // load persisted addresses
  const refreshAddresses = async () => {
    try {
      setLoading(true);
      const saved = await loadAddressBook();
      setAddresses(saved || []);
    } catch (err) {
      console.log('Error loading address book:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to load address book',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAddresses();
  }, []);

  // Handle adding a new address
  const handleAddAddress = async () => {
    if (!newName.trim()) {
      Toast.show({type: 'error', text1: 'Name is required'});
      return;
    }
    if (!validateSolanaAddress(newAddress)) {
      Toast.show({type: 'error', text1: 'Invalid Solana address'});
      return;
    }

    // Local duplicate check before attempting storage
    if (addresses.some(entry => entry.name === newName.trim())) {
      Toast.show({type: 'error', text1: 'Name already exists'});
      return;
    }
    if (addresses.some(entry => entry.address === newAddress)) {
      Toast.show({type: 'error', text1: 'Address already exists'});
      return;
    }

    try {
      const newEntry: AddressEntry = {
        name: newName.trim(),
        address: newAddress,
      };
      await addAddress(newEntry);

      // reload from storage to ensure UI reflects persisted content
      await refreshAddresses();

      setShowAddModal(false);
      setNewName('');
      setNewAddress('');
      Toast.show({type: 'success', text1: 'Address added successfully'});
    } catch (error: any) {
      console.log('Error saving address:', error);
      // if duplicate thrown by storage layer, show message
      if (error?.message?.toLowerCase?.().includes('duplicate')) {
        Toast.show({type: 'error', text1: 'Address or name already exists'});
      } else {
        Toast.show({type: 'error', text1: 'Failed to save address'});
      }
    }
  };

  // copying address
  const handleCopyAddress = async (address: string) => {
    try {
      Clipboard.setString(address);
      Toast.show({type: 'success', text1: 'Address copied to clipboard'});
    } catch (error) {
      console.log('Error copying address:', error);
      Toast.show({type: 'error', text1: 'Failed to copy address'});
    }
  };

  // delete with confirmation and reload
  const handleDeleteAddress = (address: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this address?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'OK',
          onPress: async () => {
            try {
              await deleteAddress(address);
              await refreshAddresses();
              Toast.show({
                type: 'success',
                text1: 'Address deleted successfully',
              });
            } catch (error) {
              console.log('Error deleting address:', error);
              Toast.show({type: 'error', text1: 'Failed to delete address'});
            }
          },
        },
      ],
      {cancelable: false},
    );
  };

  const renderAddress = ({item}: {item: AddressEntry}) => (
    <View className="w-full flex-row items-center justify-between bg-gray-900 border border-primary rounded-xl p-3 mb-2">
      {/* LEFT SIDE: Icon + Name + Address */}
      <View className="flex-row items-center flex-shrink">
        <UserIcon width={26} height={26} />
        <View className="ml-2">
          <Text className="text-white text-base Medium">{item.name}</Text>
          <Text className="text-gray-400 text-sm Medium" numberOfLines={1}>
            {item.address.slice(0, 6)} **** {item.address.slice(-6)}
          </Text>
        </View>
      </View>

      {/* RIGHT SIDE: Copy + Delete buttons */}
      <View className="flex-row items-center gap-6">
        <TouchableOpacity onPress={() => handleCopyAddress(item.address)}>
          <CopyIcon width={18} height={18} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteAddress(item.address)}>
          <DeleteIcon width={18} height={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // if (loading) {
  //   return (
  //     <View className="flex-1 bg-black justify-center items-center">
  //       <ActivityIndicator size="large" color="#9707B5" />
  //       <Text className="text-white mt-4">Loading address book...</Text>
  //     </View>
  //   );
  // }

  return (
    <View className="flex-1 bg-black px-4">
      {/* Header */}
      <View className="pb-3 py-6">
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          className="flex flex-row items-center gap-4">
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Address Book</Text>
        </TouchableOpacity>
      </View>

      {/* Address List */}
      <FlatList
        data={addresses}
        renderItem={renderAddress}
        keyExtractor={item => item.address}
        ListEmptyComponent={
          <Text className="text-gray-400 text-center Medium">
            No addresses saved
          </Text>
        }
        className="flex-1 w-full"
      />

      {/* Create New Address Button */}
      <View className="my-2">
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="w-full py-3 px-6 bg-[#9707B5] rounded-full">
          <Text className="text-base SemiBold text-center text-white">
            Add New Address
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Address Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <View className="bg-zinc-900 p-6 rounded-t-2xl">
            <Text className="text-white text-lg Medium mb-3">
              Add New Address
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Name"
              placeholderTextColor="#9CA3AF"
              className="bg-slate-950 text-white p-3 rounded-lg mb-3 Medium"
              style={styles.modalInput}
            />
            <TextInput
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="Solana Address"
              placeholderTextColor="#9CA3AF"
              className="bg-slate-950 text-white p-3 rounded-lg mb-4 Medium"
              style={styles.modalInput}
            />
            <TouchableOpacity
              onPress={handleAddAddress}
              className="py-3 rounded-2xl bg-[#9707B5] items-center">
              <Text className="text-white SemiBold">Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setNewName('');
                setNewAddress('');
              }}
              className="mt-3 border border-zinc-700 py-3 rounded-2xl items-center">
              <Text className="text-zinc-300 Medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  modalInput: {
    fontFamily: 'Poppins-Medium',
  },
});

export default AddressBookScreen;
