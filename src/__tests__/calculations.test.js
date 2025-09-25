import {
  calculateParticipantSummaries,
  buildSettlementPlan,
  computeExpenseState,
} from '../calculations';

describe('calculateParticipantSummaries', () => {
  const participants = [
    { id: 'a', name: 'Ana' },
    { id: 'b', name: 'Beto' },
    { id: 'c', name: 'Carla' },
  ];

  it('distributes each expense evenly among the selected participants', () => {
    const expenses = [
      {
        id: '1',
        amount: 60,
        payerId: 'a',
        participants: ['a', 'b', 'c'],
      },
      {
        id: '2',
        amount: 60,
        payerId: 'b',
        participants: ['a', 'b'],
      },
    ];

    const summaries = calculateParticipantSummaries(participants, expenses);
    const ana = summaries.find((item) => item.id === 'a');
    const beto = summaries.find((item) => item.id === 'b');
    const carla = summaries.find((item) => item.id === 'c');

    expect(ana).toMatchObject({ paid: 60, shouldPay: 50, balance: 10 });
    expect(beto).toMatchObject({ paid: 60, shouldPay: 50, balance: 10 });
    expect(carla).toMatchObject({ paid: 0, shouldPay: 20, balance: -20 });
  });

  it('ignores expenses without participants or invalid payers', () => {
    const expenses = [
      { id: '1', amount: '40', payerId: 'a', participants: ['a', 'b'] },
      { id: '2', amount: 'not-a-number', payerId: 'a', participants: ['a', 'b'] },
      { id: '3', amount: 10, payerId: 'ghost', participants: ['a'] },
      { id: '4', amount: 30, payerId: 'b', participants: [] },
    ];

    const summaries = calculateParticipantSummaries(participants, expenses);
    const ana = summaries.find((item) => item.id === 'a');
    const beto = summaries.find((item) => item.id === 'b');

    expect(ana).toMatchObject({ paid: 20, shouldPay: 20, balance: 0 });
    expect(beto).toMatchObject({ paid: 20, shouldPay: 20, balance: 0 });
  });
});

describe('buildSettlementPlan', () => {
  it('creates payments from debtors to creditors until balances are settled', () => {
    const summaries = [
      { id: 'a', name: 'Ana', balance: 30 },
      { id: 'b', name: 'Beto', balance: -10 },
      { id: 'c', name: 'Carla', balance: -20 },
    ];

    const settlements = buildSettlementPlan(summaries);

    expect(settlements).toEqual([
      { from: 'Carla', to: 'Ana', amount: 20 },
      { from: 'Beto', to: 'Ana', amount: 10 },
    ]);
  });
});

describe('computeExpenseState', () => {
  it('returns summaries, total paid and settlements', () => {
    const participants = [
      { id: '1', name: 'Ana' },
      { id: '2', name: 'Beto' },
    ];

    const expenses = [
      { id: 'a', amount: 30, payerId: '1', participants: ['1', '2'] },
    ];

    const state = computeExpenseState(participants, expenses);

    expect(state.total).toBe(30);
    expect(state.summaries).toHaveLength(2);
    expect(state.settlements).toEqual([{ from: 'Beto', to: 'Ana', amount: 15 }]);
  });
});
