import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Import shared tax logic
import {
  calculateTakeHomePay,
  taxCalculatorSchema,
  type TaxCalculatorSchema,
  regions,
  months,
  taxYears,
} from '@tax-calc/shared';

/**
 * Mobile Tax Calculator App
 *
 * This app uses the same tax logic as the web app by importing from
 * the @tax-calc/shared package. This ensures both platforms calculate
 * taxes identically.
 */
export default function App() {
  const [results, setResults] = useState(null);

  const { control, watch } = useForm<TaxCalculatorSchema>({
    resolver: zodResolver(taxCalculatorSchema),
    defaultValues: {
      taxYear: '2024/25',
      salary: 50000,
      region: 'England',
      taxCode: '1257L',
      payFrequencies: [],
    },
  });

  const watchedValues = watch();

  React.useEffect(() => {
    const parsed = taxCalculatorSchema.safeParse(watchedValues);
    if (parsed.success) {
      const calculation = calculateTakeHomePay(parsed.data);
      setResults(calculation);
    }
  }, [watchedValues]);

  if (!results) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>UK Tax Calculator</Text>
      </View>

      {/* Form inputs will go here */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Details</Text>
        {/* Add form fields using Controller */}
      </View>

      {/* Results Display */}
      <View style={styles.resultsSection}>
        <Text style={styles.sectionTitle}>Annual Results</Text>

        <View style={styles.resultRow}>
          <Text style={styles.label}>Gross Income:</Text>
          <Text style={styles.value}>£{results.grossAnnualIncome.toFixed(2)}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.label}>Income Tax:</Text>
          <Text style={styles.value}>£{results.annualTax.toFixed(2)}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.label}>National Insurance:</Text>
          <Text style={styles.value}>£{results.annualNic.toFixed(2)}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.label}>Pension:</Text>
          <Text style={styles.value}>£{results.annualPension.toFixed(2)}</Text>
        </View>

        <View style={[styles.resultRow, styles.highlightRow]}>
          <Text style={styles.labelBold}>Take Home Pay:</Text>
          <Text style={[styles.value, styles.valueBold]}>
            £{results.annualTakeHome.toFixed(2)}
          </Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.label}>Effective Tax Rate:</Text>
          <Text style={styles.value}>{results.effectiveTaxRate.toFixed(2)}%</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  resultsSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  highlightRow: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  labelBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  valueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
});
