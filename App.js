import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { computeExpenseState } from './src/calculations';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY = 'split-expense-data-v2';

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;

const formatCurrency = (value) => `€${value.toFixed(2)}`;

const sanitizeParticipants = (raw) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set();
  return raw
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : createId(),
      name:
        typeof item.name === 'string' && item.name.trim() !== ''
          ? item.name.trim()
          : 'Participante',
    }))
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
};

const sanitizeExpenses = (raw, validIds) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const sanitized = [];

  raw.forEach((expense) => {
    if (!expense || typeof expense !== 'object') {
      return;
    }

    const amount = Number.parseFloat(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const payerId = typeof expense.payerId === 'string' ? expense.payerId : '';
    if (!validIds.has(payerId)) {
      return;
    }

    const participantIds = Array.isArray(expense.participants)
      ? expense.participants.filter((id) => validIds.has(id))
      : [];

    if (participantIds.length === 0) {
      return;
    }

    sanitized.push({
      id: typeof expense.id === 'string' ? expense.id : createId(),
      description:
        typeof expense.description === 'string' && expense.description.trim() !== ''
          ? expense.description.trim()
          : 'Gasto',
      amount,
      payerId,
      participants: participantIds,
      createdAt:
        typeof expense.createdAt === 'number' && Number.isFinite(expense.createdAt)
          ? expense.createdAt
          : Date.now(),
    });
  });

  sanitized.sort((a, b) => b.createdAt - a.createdAt);
  return sanitized;
};

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [participantName, setParticipantName] = useState('');

  const [expenses, setExpenses] = useState([]);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayerId, setExpensePayerId] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  const [isReady, setIsReady] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setIsReady(true);
          return;
        }
        const parsed = JSON.parse(raw);
        const sanitizedParticipants = sanitizeParticipants(parsed.participants);
        const participantIds = new Set(sanitizedParticipants.map((item) => item.id));
        const sanitizedExpenses = sanitizeExpenses(parsed.expenses, participantIds);

        setParticipants(sanitizedParticipants);
        setExpenses(sanitizedExpenses);
      } catch (error) {
        console.warn('No se pudieron cargar los datos guardados', error);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ participants, expenses })
    ).catch((error) => {
      console.warn('No se pudieron guardar los datos', error);
    });
  }, [participants, expenses, isReady]);

  useEffect(() => {
    if (participants.length === 0) {
      setExpensePayerId('');
      setSelectedParticipants([]);
      return;
    }

    if (!participants.some((p) => p.id === expensePayerId)) {
      setExpensePayerId(participants[0].id);
    }

    setSelectedParticipants((current) => {
      const next = current.filter((id) => participants.some((p) => p.id === id));
      if (next.length === 0) {
        return participants.map((p) => p.id);
      }
      return next;
    });
  }, [participants]);

  const { summaries, settlements, total } = useMemo(
    () => computeExpenseState(participants, expenses),
    [participants, expenses]
  );

  const handleAddParticipant = () => {
    const name = participantName.trim();
    if (!name) {
      Alert.alert('Nombre requerido', 'Introduce el nombre de la persona.');
      return;
    }

    if (participants.some((participant) => participant.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicado', 'Ya existe una persona con ese nombre.');
      return;
    }

    const newParticipant = { id: createId(), name };
    setParticipants((prev) => [...prev, newParticipant]);
    setParticipantName('');
  };

  const toggleSelectedParticipant = (id) => {
    setSelectedParticipants((current) => {
      if (current.includes(id)) {
        return current.filter((participantId) => participantId !== id);
      }
      return [...current, id];
    });
  };

  const handleAddExpense = () => {
    const amount = Number.parseFloat(expenseAmount);
    if (!expenseDescription.trim()) {
      Alert.alert('Descripción requerida', 'Añade una descripción del gasto.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Importe inválido', 'Introduce un importe mayor que cero.');
      return;
    }

    if (!expensePayerId) {
      Alert.alert('Pagador', 'Selecciona quién pagó el gasto.');
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert('Participantes', 'Selecciona al menos una persona que participe en el gasto.');
      return;
    }

    const newExpense = {
      id: createId(),
      description: expenseDescription.trim(),
      amount,
      payerId: expensePayerId,
      participants: selectedParticipants,
      createdAt: Date.now(),
    };

    setExpenses((prev) => [newExpense, ...prev]);
    setExpenseDescription('');
    setExpenseAmount('');
  };

  const handleRemoveParticipant = (id) => {
    Alert.alert(
      'Eliminar participante',
      'Se borrarán también los gastos en los que participa. ¿Quieres continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setParticipants((prev) => prev.filter((participant) => participant.id !== id));
            setExpenses((prev) => prev.filter((expense) => !expense.participants.includes(id)));
          },
        },
      ]
    );
  };

  const handleRemoveExpense = (id) => {
    Alert.alert('Eliminar gasto', '¿Seguro que quieres borrarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => setExpenses((prev) => prev.filter((expense) => expense.id !== id)),
      },
    ]);
  };

  const handleReset = () => {
    Alert.alert('Borrar todo', 'Se eliminarán participantes y gastos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          setParticipants([]);
          setExpenses([]);
        },
      },
    ]);
  };

  const handleExport = async () => {
    try {
      const payload = JSON.stringify({ participants, expenses }, null, 2);
      const fileName = `split-expense-${Date.now()}.json`;
      const uri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });

      if (Platform.OS === 'web') {
        Alert.alert('Exportar no disponible en web', 'Ejecuta la app en Expo Go o compílala para Android.');
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Compartir no disponible', 'No se puede compartir el archivo en este dispositivo.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Exportar gastos',
      });
    } catch (error) {
      console.warn('No se pudieron exportar los datos', error);
      Alert.alert('Error', 'No se pudieron exportar los datos.');
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      const sanitizedParticipants = sanitizeParticipants(parsed.participants);
      const participantIds = new Set(sanitizedParticipants.map((item) => item.id));
      const sanitizedExpenses = sanitizeExpenses(parsed.expenses, participantIds);

      setParticipants(sanitizedParticipants);
      setExpenses(sanitizedExpenses);
      setImportText('');
      setImportModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'El contenido no es un JSON válido.');
    }
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Text style={styles.loadingText}>Cargando datos guardados…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>SplitExpense</Text>
        <Text style={styles.subtitle}>Divide gastos en tu grupo y mantén todo bajo control.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Participantes</Text>
          <View style={styles.inlineForm}>
            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#8b9cb5"
              value={participantName}
              onChangeText={setParticipantName}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleAddParticipant}>
              <Text style={styles.buttonText}>Añadir</Text>
            </TouchableOpacity>
          </View>
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>Añade al menos una persona para empezar.</Text>
          ) : (
            <View style={styles.listContainer}>
              {participants.map((participant) => (
                <View key={participant.id} style={styles.listItem}>
                  <Text style={styles.listItemText}>{participant.name}</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveParticipant(participant.id)}
                  >
                    <Text style={styles.deleteButtonText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nuevo gasto</Text>
          <TextInput
            style={styles.input}
            placeholder="Descripción"
            placeholderTextColor="#8b9cb5"
            value={expenseDescription}
            onChangeText={setExpenseDescription}
          />
          <TextInput
            style={styles.input}
            placeholder="Importe"
            placeholderTextColor="#8b9cb5"
            keyboardType="decimal-pad"
            value={expenseAmount}
            onChangeText={setExpenseAmount}
          />

          <Text style={styles.helperLabel}>¿Quién pagó?</Text>
          <View style={styles.chipGroup}>
            {participants.map((participant) => (
              <Pressable
                key={participant.id}
                style={[
                  styles.chip,
                  expensePayerId === participant.id && styles.chipSelected,
                ]}
                onPress={() => setExpensePayerId(participant.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    expensePayerId === participant.id && styles.chipTextSelected,
                  ]}
                >
                  {participant.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.helperLabel}>¿Quién participa?</Text>
          <View style={styles.chipGroup}>
            {participants.map((participant) => {
              const selected = selectedParticipants.includes(participant.id);
              return (
                <Pressable
                  key={participant.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleSelectedParticipant(participant.id)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {participant.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleAddExpense}>
            <Text style={styles.buttonText}>Guardar gasto</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Gastos registrados</Text>
            <Text style={styles.totalText}>Total pagado: {formatCurrency(total)}</Text>
          </View>
          {expenses.length === 0 ? (
            <Text style={styles.emptyText}>Añade un gasto para ver el listado.</Text>
          ) : (
            <FlatList
              data={expenses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.expenseItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseTitle}>{item.description}</Text>
                    <Text style={styles.expenseSubtitle}>
                      {formatCurrency(item.amount)} pagó{' '}
                      {participants.find((p) => p.id === item.payerId)?.name ?? 'Alguien'}
                    </Text>
                    <Text style={styles.expenseSubtitle}>
                      Participan:{' '}
                      {item.participants
                        .map((id) => participants.find((p) => p.id === id)?.name || '—')
                        .join(', ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveExpense(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              scrollEnabled={false}
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resumen por persona</Text>
          {summaries.length === 0 ? (
            <Text style={styles.emptyText}>Aquí verás cuánto debe cada persona.</Text>
          ) : (
            summaries.map((summary) => (
              <View key={summary.id} style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryName}>{summary.name}</Text>
                  <Text style={styles.summaryDetail}>
                    Pagó {formatCurrency(summary.paid)} · Debe {formatCurrency(summary.shouldPay)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.summaryBalance,
                    summary.balance < 0 ? styles.negativeBalance : styles.positiveBalance,
                  ]}
                >
                  {formatCurrency(summary.balance)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>¿Quién paga a quién?</Text>
          {settlements.length === 0 ? (
            <Text style={styles.emptyText}>Todos están en paz. 🎉</Text>
          ) : (
            settlements.map((settlement, index) => (
              <View key={`${settlement.from}-${index}`} style={styles.settlementRow}>
                <Text style={styles.settlementText}>
                  {settlement.from} → {settlement.to}
                </Text>
                <Text style={styles.settlementAmount}>{formatCurrency(settlement.amount)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleExport}>
            <Text style={styles.secondaryButtonText}>Exportar datos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setImportModalVisible(true)}
          >
            <Text style={styles.secondaryButtonText}>Importar datos</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
          <Text style={styles.buttonText}>Borrar todo</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={importModalVisible}
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Pega aquí el JSON exportado</Text>
            <TextInput
              style={styles.importInput}
              multiline
              textAlignVertical="top"
              value={importText}
              onChangeText={setImportText}
              placeholder="{ \"participants\": [], \"expenses\": [] }"
              placeholderTextColor="#8b9cb5"
            />
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setImportText('');
                  setImportModalVisible(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleImport}>
                <Text style={styles.buttonText}>Importar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1321',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8f9ff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#d1d7e0',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#19233c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#f8f9ff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  inlineForm: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#101a2b',
    color: '#f8f9ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#3a7dff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    backgroundColor: '#cf3e53',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a7dff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#d1e3ff',
    fontWeight: '600',
  },
  buttonText: {
    color: '#f8f9ff',
    fontWeight: '600',
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    backgroundColor: '#101a2b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemText: {
    color: '#f8f9ff',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#27324d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#ff9aa2',
    fontWeight: '600',
  },
  helperLabel: {
    color: '#9fb3d1',
    marginBottom: 8,
    marginTop: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#3a7dff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: {
    backgroundColor: '#3a7dff',
  },
  chipText: {
    color: '#d1e3ff',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0d1321',
  },
  emptyText: {
    color: '#9fb3d1',
    fontStyle: 'italic',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalText: {
    color: '#f8f9ff',
    fontWeight: '600',
  },
  expenseItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  expenseTitle: {
    color: '#f8f9ff',
    fontSize: 16,
    fontWeight: '600',
  },
  expenseSubtitle: {
    color: '#9fb3d1',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#23314f',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#23314f',
  },
  summaryName: {
    color: '#f8f9ff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryDetail: {
    color: '#9fb3d1',
    marginTop: 2,
  },
  summaryBalance: {
    fontSize: 16,
    fontWeight: '700',
  },
  positiveBalance: {
    color: '#7ad3a8',
  },
  negativeBalance: {
    color: '#ff9aa2',
  },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#23314f',
  },
  settlementText: {
    color: '#f8f9ff',
    fontSize: 16,
  },
  settlementAmount: {
    color: '#7ad3a8',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(13, 19, 33, 0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#19233c',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  importInput: {
    minHeight: 160,
    backgroundColor: '#101a2b',
    color: '#f8f9ff',
    borderRadius: 12,
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0d1321',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#f8f9ff',
    fontSize: 16,
  },
});
