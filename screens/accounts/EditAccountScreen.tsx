import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'react-native-image-picker';

import { RootStackParamList } from '../../types/navigation';

import BackIcon from '../../assets/icons/back-arrow.svg';
import EditProfileIcon from '../../assets/icons/edit-profile-icon.svg';
import NavArrowIcon from '../../assets/icons/nav-arrow-icon.svg';

import { loadWallet, WalletAccount, saveWallet } from '../../utils/storage';
import { deleteAccount } from '../../utils/wallet';

type Props = NativeStackScreenProps<RootStackParamList, 'EditAccount'>;

const EditAccountScreen = ({ route, navigation }: Props) => {
  const { accountId } = route.params;

  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadAccount = async () => {
      const wallet = await loadWallet();
      if (wallet) {
        const acc = wallet.accounts.find(a => a.id === accountId);
        setAccount(acc || null);
        setImageUri(acc?.imageUri);
      }
    };

    loadAccount();
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      const loadAccount = async () => {
        const wallet = await loadWallet();
        if (wallet) {
          const acc = wallet.accounts.find(a => a.id === accountId);
          setAccount(acc || null);
          setImageUri(acc?.imageUri);
        }
      };

      loadAccount();
    }, [accountId]),
  );

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const permission =
        Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const status = await PermissionsAndroid.check(permission);
      if (status) return true;

      const result = await PermissionsAndroid.request(permission, {
        title: 'Storage Permission',
        message:
          'This app needs access to your photos to select a profile image.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      });

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else if (result === PermissionsAndroid.RESULTS.DENIED) {
        Alert.alert(
          'Permission Required',
          'Storage access is needed to select a profile image. Please grant permission.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Retry',
              onPress: async () => {
                const retryResult = await requestStoragePermission();
                if (!retryResult) {
                  Alert.alert(
                    'Permission Denied',
                    'Please enable storage permission in your device settings to proceed.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Open Settings',
                        onPress: () => Linking.openSettings(),
                      },
                    ],
                  );
                }
              },
            },
          ],
        );
        return false;
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permission Denied',
          'Storage permission was permanently denied. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ],
        );
        return false;
      }
      return false;
    } catch (err) {
      console.log('Permission error:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to request permission.',
      });
      return false;
    }
  };

  const handleProfileEdit = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      return;
    }

    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
    };

    ImagePicker.launchImageLibrary(options, async response => {
      if (response.didCancel) {
        Toast.show({
          type: 'error',
          text1: 'User cancelled image picker',
        });
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        Toast.show({
          type: 'error',
          text1: 'Failed to pick image',
        });
      } else if (response.assets && response.assets[0]?.uri) {
        const source = response.assets[0];
        if (!source.uri) {
          Toast.show({
            type: 'error',
            text1: 'No image URI found.',
          });
          return;
        }

        const folderPath = `${RNFS.DocumentDirectoryPath}/profile_images`;
        await RNFS.mkdir(folderPath);

        const fileName = `profile_${accountId}_${Date.now()}.jpg`;
        const destPath = `${folderPath}/${fileName}`;
        await RNFS.copyFile(source.uri, destPath);
        const newImageUri = `file://${destPath}`;

        if (imageUri) {
          const oldPath = imageUri.replace('file://', '');
          await RNFS.unlink(oldPath).catch(() => {});
        }

        const wallet = await loadWallet();
        if (wallet && account) {
          const updatedAccounts = wallet.accounts.map(a =>
            a.id === accountId ? { ...a, imageUri: newImageUri } : a,
          );
          await saveWallet({ ...wallet, accounts: updatedAccounts });
          setImageUri(newImageUri);
          setAccount({ ...account, imageUri: newImageUri });
          Toast.show({
            type: 'success',
            text1: 'Logo updated successfully',
          });
        }
      }
    });
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Confirm Removal',
      'Are you sure you want to remove the profile image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            try {
              if (imageUri) {
                const filePath = imageUri.replace('file://', '');
                await RNFS.unlink(filePath);
              }
              const wallet = await loadWallet();
              if (wallet && account) {
                const updatedAccounts = wallet.accounts.map(a =>
                  a.id === accountId ? { ...a, imageUri: undefined } : a,
                );
                await saveWallet({ ...wallet, accounts: updatedAccounts });
                setImageUri(undefined);
                setAccount({ ...account, imageUri: undefined });
                Toast.show({
                  type: 'success',
                  text1: 'Profile image removed',
                });
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Failed to remove image',
              });
            }
          },
        },
      ],
    );
  };

  const handleNameEdit = () => {
    navigation.navigate('AccountName', {
      accountId,
      currentName: account?.name || '',
    });
  };

  const handleShowAddress = () => {
    navigation.navigate('QRCode', { accountId });
  };

  const handleShowPrivateKey = () => {
    navigation.navigate('PrivateKey', { accountId });
  };

  const handleRemoveAccount = () => {
    Alert.alert(
      'Confirm Removal',
      'Are you sure you want to remove this account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            try {
              await deleteAccount(accountId);
              navigation.navigate('Accounts');
              Toast.show({
                type: 'success',
                text1: 'Account deleted successfully',
              });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Failed to remove account',
              });
            }
          },
        },
      ],
    );
  };

  const handleGoBack = () => {
    navigation.navigate('Accounts');
  };

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Back Arrow and Title */}
      <View className="pb-3 mb-4">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Edit Account</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Image Section */}
      <View className="w-full">
        <View className="w-full flex items-center justify-center">
          <View className="w-[96px] relative h-[96px] rounded-full flex items-center justify-center">
            <Image
              source={
                imageUri
                  ? { uri: imageUri }
                  : require('../../assets/images/user-logo.png')
              }
              className="absolute z-0"
              resizeMode="cover"
              style={{ width: 96, height: 96 }}
            />
            {!imageUri && (
              <Text className="text-4xl text-black text-center ">
                {account?.name?.charAt(0) || 'A'}
              </Text>
            )}
            <TouchableOpacity
              onPress={handleProfileEdit}
              className="w-6 h-6 p-1 border-[3px] bg-[#9707B5] border-black z-10 rounded-full absolute bottom-1 right-0 flex items-center justify-center"
            >
              <EditProfileIcon width={8} height={8} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="text-center mt-4">
          <Text className="text-base text-center text-white Medium">
            {account?.name || 'Account 1'}
          </Text>
        </View>

        {/* Options List */}
        <View className="w-full mt-5">
          <TouchableOpacity
            onPress={handleNameEdit}
            className="py-5 border-b border-gray7"
          >
            <View className="w-full flex flex-row items-center justify-between">
              <Text className="text-base text-white Medium">Account Name</Text>
              <NavArrowIcon width={16} height={16} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShowAddress}
            className="py-5 border-b border-gray7"
          >
            <View className="w-full flex flex-row items-center justify-between">
              <Text className="text-base text-white Medium">
                Account Address
              </Text>
              <View className="flex flex-row items-center gap-2">
                <NavArrowIcon width={16} height={16} />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShowPrivateKey}
            className="py-5 border-b border-gray7"
          >
            <View className="w-full flex flex-row items-center justify-between">
              <Text className="text-base text-white Medium">
                Show Private Key
              </Text>
              <View className="flex flex-row items-center gap-2">
                <NavArrowIcon width={16} height={16} />
              </View>
            </View>
          </TouchableOpacity>

          {imageUri && (
            <TouchableOpacity
              onPress={handleRemoveImage}
              className="py-5 border-b border-gray7"
            >
              <View className="w-full flex flex-row items-center justify-between">
                <Text className="text-base text-red-600 Medium">
                  Remove Profile Image
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleRemoveAccount} className="py-5">
            <View className="w-full flex flex-row items-center justify-between">
              <Text className="text-base text-red-600 Medium">
                Remove Account
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default EditAccountScreen;
