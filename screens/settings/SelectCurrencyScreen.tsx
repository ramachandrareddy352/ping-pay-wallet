import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import {RootStackParamList} from '../../types/navigation';
import {Currency} from '../../types/dataTypes';

import {saveCurrency, loadCurrency} from '../../utils/storage';

import BackIcon from '../../assets/icons/back-arrow.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectCurrency'>;

const SelectCurrencyScreen = ({navigation}: Props) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filteredCurrencies, setFilteredCurrencies] = useState<Currency[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          'https://restcountries.com/v3.1/all?fields=name,currencies',
        );
        const data = await response.json();
        const currencyList: Currency[] = [];
        data.forEach((country: any) => {
          if (country.currencies) {
            Object.entries(country.currencies).forEach(
              ([code, info]: [string, any]) => {
                if (!currencyList.find(c => c.code === code)) {
                  currencyList.push({
                    code,
                    symbol: info.symbol || '',
                    name: info.name,
                  });
                }
              },
            );
          }
        });
        // Sort by code
        currencyList.sort((a, b) => a.code.localeCompare(b.code));
        setCurrencies(currencyList);
        setFilteredCurrencies(currencyList);
      } catch (error) {
        console.log('Error fetching currencies:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load currencies',
        });
      } finally {
        setLoading(false);
      }
    };

    const loadSelectedCurrency = async () => {
      try {
        const currency = await loadCurrency();
        setSelectedCurrency(currency || 'USD'); // Default to USD
      } catch (error) {
        console.log('Error loading currency:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to load currency preference',
        });
        setSelectedCurrency('USD'); // Fallback to USD
      }
    };

    fetchCurrencies();
    loadSelectedCurrency();
  }, []);

  useEffect(() => {
    // Update filteredCurrencies to prioritize selected currency
    if (selectedCurrency && currencies.length > 0) {
      const selected = currencies.find(c => c.code === selectedCurrency);
      const others = currencies.filter(c => c.code !== selectedCurrency);
      if (searchQuery === '') {
        setFilteredCurrencies(selected ? [selected, ...others] : others);
      } else {
        const filtered = currencies.filter(
          c =>
            c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
        const selectedInFiltered = filtered.find(
          c => c.code === selectedCurrency,
        );
        const othersInFiltered = filtered.filter(
          c => c.code !== selectedCurrency,
        );
        setFilteredCurrencies(
          selectedInFiltered
            ? [selectedInFiltered, ...othersInFiltered]
            : othersInFiltered,
        );
      }
    } else {
      setFilteredCurrencies(
        searchQuery === ''
          ? currencies
          : currencies.filter(
              c =>
                c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
      );
    }
  }, [currencies, selectedCurrency, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSelectCurrency = async (
    currencyCode: string,
    currencyName: string,
  ) => {
    try {
      await saveCurrency(currencyCode);
      setSelectedCurrency(currencyCode);
      Toast.show({
        type: 'success',
        text1: `Currency updated to ${currencyName}`,
      });
    } catch (error) {
      console.log('Error saving currency:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update currency',
      });
    }
  };

  const handleGoBack = () => {
    navigation.navigate('Settings');
  };

  const renderCurrencyItem = ({item}: {item: Currency}) => (
    <TouchableOpacity
      onPress={() => handleSelectCurrency(item.code, item.name)}
      className={`py-4 px-4 rounded-lg mb-2 ${
        selectedCurrency === item.code
          ? 'bg-[#9707B5] mb-4 border-white border-l-4'
          : 'bg-zinc-900'
      }`}>
      <Text className="text-base text-white Medium">
        {`${item.code} (${item.symbol || ''}) - ${item.name}`}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black px-4 py-6">
      {/* Back Arrow and Title */}
      <View className="pb-3 mb-4">
        <TouchableOpacity
          onPress={handleGoBack}
          className="flex flex-row items-center gap-4">
          <BackIcon width={16} height={16} />
          <Text className="text-base Medium text-white">Select Currency</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TextInput
        value={searchQuery}
        onChangeText={handleSearch}
        placeholder="Search currencies"
        placeholderTextColor="#9CA3AF"
        className="bg-zinc-900 text-white p-3 rounded-lg mb-4"
      />

      {/* Currency List */}
      <FlatList
        data={filteredCurrencies}
        renderItem={renderCurrencyItem}
        keyExtractor={item => item.code}
        className="flex-1"
      />
    </View>
  );
};

export default SelectCurrencyScreen;
