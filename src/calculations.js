const CENT_FACTOR = 100;

const toCents = (value) => Math.round(Number(value) * CENT_FACTOR);
const fromCents = (value) => value / CENT_FACTOR;

const isValidParticipant = (participant) =>
  participant && typeof participant.id === 'string' && participant.id !== '';

const isValidExpense = (expense, participantIds) => {
  if (!expense || typeof expense !== 'object') {
    return false;
  }

  const amount = Number.parseFloat(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  const payerId = typeof expense.payerId === 'string' ? expense.payerId : '';
  if (!participantIds.has(payerId)) {
    return false;
  }

  const participants = Array.isArray(expense.participants)
    ? expense.participants.filter((id) => participantIds.has(id))
    : [];

  if (participants.length === 0) {
    return false;
  }

  return true;
};

export function calculateParticipantSummaries(participants = [], expenses = []) {
  const validParticipants = participants.filter(isValidParticipant);
  const participantIds = new Set(validParticipants.map((p) => p.id));

  const summaries = new Map(
    validParticipants.map((participant) => [
      participant.id,
      {
        id: participant.id,
        name:
          typeof participant.name === 'string' && participant.name.trim() !== ''
            ? participant.name.trim()
            : 'Participante',
        paid: 0,
        shouldPay: 0,
        balance: 0,
      },
    ])
  );

  expenses.filter((expense) => isValidExpense(expense, participantIds)).forEach((expense) => {
    const amount = toCents(expense.amount);
    const share = Math.floor(amount / expense.participants.length);
    const remainder = amount - share * expense.participants.length;

    const payer = summaries.get(expense.payerId);
    if (payer) {
      payer.paid += amount;
    }

    expense.participants.forEach((participantId, index) => {
      const participant = summaries.get(participantId);
      if (!participant) {
        return;
      }

      let participantShare = share;
      if (remainder > 0 && index === 0) {
        participantShare += remainder;
      }
      participant.shouldPay += participantShare;
    });
  });

  return Array.from(summaries.values()).map((summary) => {
    const balance = summary.paid - summary.shouldPay;
    return {
      ...summary,
      paid: fromCents(summary.paid),
      shouldPay: fromCents(summary.shouldPay),
      balance: fromCents(balance),
    };
  });
}

export function buildSettlementPlan(summaries = []) {
  const creditors = [];
  const debtors = [];

  summaries.forEach((summary) => {
    const balanceCents = Math.round(summary.balance * CENT_FACTOR);
    if (balanceCents > 0) {
      creditors.push({
        id: summary.id,
        name: summary.name,
        remaining: balanceCents,
      });
    } else if (balanceCents < 0) {
      debtors.push({
        id: summary.id,
        name: summary.name,
        remaining: -balanceCents,
      });
    }
  });

  creditors.sort((a, b) => b.remaining - a.remaining);
  debtors.sort((a, b) => b.remaining - a.remaining);

  const settlements = [];

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0];
    const debtor = debtors[0];
    const payment = Math.min(creditor.remaining, debtor.remaining);

    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: fromCents(payment),
    });

    creditor.remaining -= payment;
    debtor.remaining -= payment;

    if (creditor.remaining === 0) {
      creditors.shift();
    } else {
      creditors.sort((a, b) => b.remaining - a.remaining);
    }

    if (debtor.remaining === 0) {
      debtors.shift();
    } else {
      debtors.sort((a, b) => b.remaining - a.remaining);
    }
  }

  return settlements;
}

export function computeExpenseState(participants, expenses) {
  const summaries = calculateParticipantSummaries(participants, expenses);
  const total = summaries.reduce((acc, summary) => acc + summary.paid, 0);
  const settlements = buildSettlementPlan(summaries);

  return {
    summaries,
    total,
    settlements,
  };
}
