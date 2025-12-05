import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../types/navigation';

import { loadWallet, WalletData } from '../../utils/storage';

// Import your icons
import NetworkIcon from '../../assets/icons/network.svg';
import NotificationIcon from '../../assets/icons/notification.svg';
import LockIcon from '../../assets/icons/shield.svg';
import KeyIcon from '../../assets/icons/padlock.svg';
import RecoveryIcon from '../../assets/icons/passcode.svg';
import AddressBookIcon from '../../assets/icons/book.svg';
import HelpIcon from '../../assets/icons/help.svg';
import TermsIcon from '../../assets/icons/terms.svg';
import InfoIcon from '../../assets/icons/Info-icon-white.svg';
import ResetIcon from '../../assets/icons/exit.svg';
import BackIcon from '../../assets/icons/back-arrow.svg';
import RightArrowIcon from '../../assets/icons/move-right.svg';

import BottomNavBar from '../../components/BottomNavBar';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const settingsOptions = [
  {
    title: 'Network Preference',
    description: 'Choose your preferred blockchain network',
    icon: NetworkIcon,
    navigateTo: 'NetworkPreference',
  },
  // {
  //   title: 'Display Language',
  //   description: 'Manage your app language',
  //   icon: LanguageIcon,
  //   navigateTo: 'SelectLanguage',
  // },
  // {
  //   title: 'Currency',
  //   description: 'Manage your default currency',
  //   icon: CurrencyIcon,
  //   navigateTo: 'SelectCurrency',
  // },
  // {
  //   title: 'Notifications',
  //   description: 'Manage push and in-app alerts',
  //   icon: NotificationIcon,
  //   navigateTo: 'Home',
  // },
  {
    title: 'Require Authentication',
    description: 'Set lock time when every time opened',
    icon: LockIcon,
    navigateTo: 'RequireAuth',
  },
  {
    title: 'Change Passcode',
    description: 'Update your current passcode',
    icon: KeyIcon,
    navigateTo: 'ResetPassword',
  },
  {
    title: 'Show Recovery Phrase',
    description: 'Display your wallet recovery phrase',
    icon: RecoveryIcon,
    navigateTo: 'ShowMnemonic',
  },
  {
    title: 'Address Book',
    description: 'Save frequently used addresses',
    icon: AddressBookIcon,
    navigateTo: 'AddressBook',
  },
  {
    title: 'Help',
    description: 'Get support and FAQs',
    icon: HelpIcon,
    navigateTo: 'Home',
  },
  {
    title: 'Terms and Conditions',
    description: 'Read our terms of service',
    icon: TermsIcon,
    navigateTo: 'TermsAndConditions',
  },
  {
    title: 'About',
    description: 'Learn more about this app',
    icon: InfoIcon,
    navigateTo: 'Home',
  },
  {
    title: 'Reset App',
    description: 'Clear all data and start fresh',
    icon: ResetIcon,
    navigateTo: 'ResetApp',
  },
];

export default function SettingsScreen({ navigation }: Props) {
  const [currentAccountId, setCurrentAccountId] = useState<string>('');

  // Load current account ID from storage
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const wallet: WalletData | null = await loadWallet();
        if (wallet && wallet.currentAccountId) {
          setCurrentAccountId(wallet.currentAccountId);
        } else {
          setCurrentAccountId(''); // Fallback to empty string if no account ID
        }
      } catch (error) {
        console.log('Error loading wallet:', error);
        setCurrentAccountId('');
      }
    };

    fetchWallet();
  }, []);

  return (
    <View className="flex-1 bg-black">
      {/* Back Arrow and Title */}
      <View className="pt-6 px-4">
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          className="flex flex-row items-center gap-4"
        >
          <BackIcon width={16} height={16} fill="#D1D5DB" />
          <Text className=" text-base Medium text-white">Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Settings List */}
      <ScrollView className="flex-1 px-4">
        {settingsOptions.map((item, index) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => navigation.navigate(item.navigateTo as any)}
              className="flex-row items-center justify-between py-4 active:bg-gray-900"
            >
              <View className="flex-row items-center flex-1">
                {/* Icon */}
                <Icon width={22} height={22} />
                <View className="ml-3 flex-1">
                  <Text className=" text-white text-base">{item.title}</Text>
                  <Text className=" text-gray-400 text-xs">
                    {item.description}
                  </Text>
                </View>
              </View>
              {/* Arrow */}
              <RightArrowIcon width={16} height={16} fill="#9707B5" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <BottomNavBar active="null" />
    </View>
  );
}
