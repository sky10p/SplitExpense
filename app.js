(function () {
  const STORAGE_KEY = "split-expense-data-v1";
  const state = {
    participants: [],
    expenses: [],
  };

  const els = {
    participantForm: document.getElementById("participant-form"),
    participantName: document.getElementById("participant-name"),
    participantsList: document.getElementById("participants-list"),
    expenseForm: document.getElementById("expense-form"),
    expenseDescription: document.getElementById("expense-description"),
    expenseAmount: document.getElementById("expense-amount"),
    expensePayer: document.getElementById("expense-payer"),
    expenseParticipants: document.getElementById("expense-participants"),
    expenseSubmit: document.querySelector("#expense-form button[type='submit']"),
    expensesList: document.getElementById("expenses-list"),
    totalSpent: document.getElementById("total-spent"),
    summaryEmpty: document.getElementById("summary-empty"),
    summaryList: document.getElementById("summary-list"),
    settlements: document.getElementById("settlements"),
    settlementsList: document.getElementById("settlements-list"),
    resetButton: document.getElementById("reset-data"),
    exportButton: document.getElementById("export-data"),
    importButton: document.getElementById("import-data"),
    importInput: document.getElementById("import-file"),
    expenseTemplate: document.getElementById("expense-item-template"),
  };

  const formatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function init() {
    loadState();
    bindEvents();
    renderAll();
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function bindEvents() {
    els.participantForm.addEventListener("submit", handleParticipantSubmit);
    els.expenseForm.addEventListener("submit", handleExpenseSubmit);
    els.resetButton.addEventListener("click", handleReset);
    els.exportButton.addEventListener("click", handleExport);
    els.importButton.addEventListener("click", handleImportClick);
    els.importInput.addEventListener("change", handleImportFile);
  }

  function handleParticipantSubmit(event) {
    event.preventDefault();
    const name = els.participantName.value.trim();

    if (!name) {
      return;
    }

    if (state.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert("Ya existe una persona con ese nombre.");
      return;
    }

    state.participants.push({ id: createId(), name });
    els.participantForm.reset();
    persistAndRender();
  }

  function handleExpenseSubmit(event) {
    event.preventDefault();

    const description = els.expenseDescription.value.trim();
    const amount = Number.parseFloat(els.expenseAmount.value);
    const payerId = els.expensePayer.value;
    const involved = Array.from(
      els.expenseParticipants.querySelectorAll("input[type='checkbox']")
    )
      .filter((input) => input.checked)
      .map((input) => input.value);

    if (!description || Number.isNaN(amount) || amount <= 0) {
      alert("Introduce un importe válido.");
      return;
    }

    if (!payerId) {
      alert("Selecciona quién pagó el gasto.");
      return;
    }

    if (involved.length === 0) {
      alert("Selecciona al menos una persona para repartir el gasto.");
      return;
    }

    const now = Date.now();

    state.expenses.push({
      id: createId(),
      description,
      amount,
      payerId,
      participants: involved,
      createdAt: now,
    });

    els.expenseForm.reset();
    selectAllParticipants();
    persistAndRender();
  }

  function handleReset() {
    if (
      confirm(
        "¿Seguro que quieres borrar todos los datos? Esta acción no se puede deshacer."
      )
    ) {
      state.participants = [];
      state.expenses = [];
      persistAndRender();
    }
  }

  function handleExport() {
    if (state.participants.length === 0 && state.expenses.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const payload = buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = formatExportDate(new Date());
    link.href = url;
    link.download = `split-expense-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    els.importInput.click();
  }

  function handleImportFile(event) {
    const input = event.target;
    const [file] = input.files || [];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const text = String(loadEvent.target?.result || "");
        const parsed = JSON.parse(text);
        const { participants, expenses } = normalizeImportedData(parsed);

        if (participants.length === 0 && expenses.length > 0) {
          throw new Error("No participants");
        }

        state.participants = participants;
        state.expenses = expenses;
        persistAndRender();
        alert("Datos importados correctamente.");
      } catch (error) {
        console.error("Importación fallida", error);
        alert(
          "No se pudieron importar los datos. Asegúrate de seleccionar un archivo válido."
        );
      } finally {
        input.value = "";
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function persistAndRender() {
    saveState();
    renderAll();
  }

  function renderAll() {
    renderParticipants();
    renderExpenseControls();
    renderExpenses();
    renderSummary();
    updateDataControls();
  }

  function renderParticipants() {
    els.participantsList.innerHTML = "";

    if (state.participants.length === 0) {
      const empty = document.createElement("li");
  empty.textContent = "Añade personas para comenzar";
      empty.className = "empty";
      els.participantsList.appendChild(empty);
      return;
    }

    state.participants.forEach((participant) => {
      const li = document.createElement("li");
      li.textContent = participant.name;

      const removeButton = document.createElement("button");
      removeButton.className = "chip-remove";
      removeButton.type = "button";
      removeButton.title = "Eliminar";
      removeButton.textContent = "x";
      removeButton.addEventListener("click", () => handleRemoveParticipant(participant.id));

      li.appendChild(removeButton);
      els.participantsList.appendChild(li);
    });
  }

  function handleRemoveParticipant(participantId) {
    const name = getParticipantName(participantId);
    const hasExpenses = state.expenses.some(
      (expense) =>
        expense.payerId === participantId || expense.participants.includes(participantId)
    );

    if (hasExpenses) {
      alert(
        `${name} forma parte de algún gasto. Borra primero los gastos asociados antes de eliminar a la persona.`
      );
      return;
    }

    state.participants = state.participants.filter((p) => p.id !== participantId);
    persistAndRender();
  }

  function renderExpenseControls() {
    const previouslySelected = new Set(
      Array.from(
        els.expenseParticipants.querySelectorAll("input[type='checkbox']")
      )
        .filter((input) => input.checked)
        .map((input) => input.value)
    );

    els.expensePayer.innerHTML = "";
    els.expenseParticipants.innerHTML = "";

    if (state.participants.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.disabled = true;
      option.selected = true;
  option.textContent = "Primero añade personas";
      els.expensePayer.appendChild(option);
      els.expensePayer.disabled = true;
      els.expenseSubmit.disabled = true;
      return;
    }

    els.expensePayer.disabled = false;
    els.expenseSubmit.disabled = false;

    state.participants.forEach((participant) => {
      const option = document.createElement("option");
      option.value = participant.id;
      option.textContent = participant.name;
      els.expensePayer.appendChild(option);
    });

    if (!state.participants.some((p) => p.id === els.expensePayer.value)) {
      els.expensePayer.value = state.participants[0].id;
    }

    state.participants.forEach((participant) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "participants";
      checkbox.value = participant.id;
      const shouldCheck =
        previouslySelected.size > 0
          ? previouslySelected.has(participant.id)
          : true;
      checkbox.checked = shouldCheck;
      checkbox.defaultChecked = shouldCheck;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(participant.name));
      els.expenseParticipants.appendChild(label);
    });
  }

  function selectAllParticipants() {
    els.expenseParticipants
      .querySelectorAll("input[type='checkbox']")
      .forEach((input) => {
        input.checked = true;
        input.defaultChecked = true;
      });
  }

  function renderExpenses() {
    els.expensesList.innerHTML = "";

    if (state.expenses.length === 0) {
      const empty = document.createElement("li");
  empty.textContent = "Todavía no hay gastos registrados";
      empty.className = "empty";
      els.expensesList.appendChild(empty);
      els.totalSpent.textContent = "Total: 0 EUR";
      return;
    }

    const template = els.expenseTemplate.content.firstElementChild;

    state.expenses
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((expense) => {
        const clone = template.cloneNode(true);
        const descriptionEl = clone.querySelector(".expenses__description");
        const metaEl = clone.querySelector(".expenses__meta");
        const removeBtn = clone.querySelector("button");

        descriptionEl.textContent = `${expense.description} - ${formatCurrency(expense.amount)}`;
        const payerName = getParticipantName(expense.payerId) || "(desconocido)";
        const involvedNames = expense.participants
          .map((id) => getParticipantName(id))
          .filter(Boolean)
          .join(", ");

  metaEl.textContent = `Pagó ${payerName} · Participan: ${involvedNames}`;
        removeBtn.addEventListener("click", () => handleRemoveExpense(expense.id));

        els.expensesList.appendChild(clone);
      });

    const total = state.expenses.reduce((acc, expense) => acc + expense.amount, 0);
    els.totalSpent.textContent = `Total: ${formatCurrency(total)}`;
  }

  function handleRemoveExpense(expenseId) {
    if (confirm("Eliminar este gasto?")) {
      state.expenses = state.expenses.filter((expense) => expense.id !== expenseId);
      persistAndRender();
    }
  }

  function renderSummary() {
    els.summaryList.innerHTML = "";
    els.settlementsList.innerHTML = "";

    if (state.participants.length === 0 || state.expenses.length === 0) {
      els.summaryEmpty.style.display = "block";
      els.settlements.style.display = "none";
      return;
    }

    els.summaryEmpty.style.display = "none";

    const balances = calculateBalances();

    balances.forEach((balance) => {
      const dt = document.createElement("dt");
      dt.textContent = balance.name;
      const dd = document.createElement("dd");
  const paidText = `Pagó ${formatCurrency(balance.paid)}`;
      const shareText = `Su parte: ${formatCurrency(balance.share)}`;
      const netText =
        Math.abs(balance.net) < 0.01
          ? "Está cuadrado"
          : balance.net > 0
          ? `Debe recibir ${formatCurrency(balance.net)}`
          : `Debe pagar ${formatCurrency(Math.abs(balance.net))}`;

      dd.innerHTML = `${paidText} - ${shareText} - ${netText}`;

      els.summaryList.appendChild(dt);
      els.summaryList.appendChild(dd);
    });

    const settlements = buildSettlements(balances);

    if (settlements.length === 0) {
      els.settlements.style.display = "none";
      return;
    }

    els.settlements.style.display = "block";

    settlements.forEach((settlement) => {
      const li = document.createElement("li");
      li.textContent = `${settlement.from} paga ${formatCurrency(
        settlement.amount
      )} a ${settlement.to}`;
      els.settlementsList.appendChild(li);
    });
  }

  function updateDataControls() {
    const hasData = state.participants.length > 0 || state.expenses.length > 0;

    if (els.exportButton) {
      els.exportButton.disabled = !hasData;
    }

    if (els.resetButton) {
      els.resetButton.disabled = !hasData;
      els.resetButton.setAttribute("aria-disabled", String(!hasData));
    }
  }

  function calculateBalances() {
    return state.participants.map((participant) => {
      const paid = state.expenses
        .filter((expense) => expense.payerId === participant.id)
        .reduce((acc, expense) => acc + expense.amount, 0);

      const share = state.expenses.reduce((acc, expense) => {
        if (!expense.participants.includes(participant.id)) {
          return acc;
        }
        const portion = expense.amount / expense.participants.length;
        return acc + portion;
      }, 0);

      return {
        id: participant.id,
        name: participant.name,
        paid,
        share,
        net: paid - share,
      };
    });
  }

  function buildSettlements(balances) {
    const debtors = balances
      .filter((balance) => balance.net < -0.01)
      .map((balance) => ({ ...balance, net: Math.abs(balance.net) }));
    const creditors = balances
      .filter((balance) => balance.net > 0.01)
      .map((balance) => ({ ...balance }));

    const settlements = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.net, creditor.net);

      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });

      debtor.net -= amount;
      creditor.net -= amount;

      if (debtor.net <= 0.01) {
        debtorIndex += 1;
      }

      if (creditor.net <= 0.01) {
        creditorIndex += 1;
      }
    }

    return settlements;
  }

  function buildExportPayload() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      participants: state.participants,
      expenses: state.expenses,
    };
  }

  function normalizeImportedData(raw) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid payload");
    }

    const participants = sanitizeParticipants(raw.participants);
    const participantIds = new Set(participants.map((p) => p.id));
    const expenses = sanitizeExpenses(raw.expenses, participantIds);

    return { participants, expenses };
  }

  function sanitizeParticipants(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }

    const seen = new Set();

    return raw
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id.trim() : "",
        name: typeof item.name === "string" ? item.name.trim() : "",
      }))
      .filter((item) => item.id && item.name && !seen.has(item.id))
      .map((item) => {
        seen.add(item.id);
        return item;
      });
  }

  function sanitizeExpenses(raw, validIds) {
    if (!Array.isArray(raw)) {
      return [];
    }

    const sanitized = [];

    raw.forEach((expense) => {
      if (!expense || typeof expense !== "object") {
        return;
      }

      const amount = Number.parseFloat(expense.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      const payerId = typeof expense.payerId === "string" ? expense.payerId : "";
      if (!validIds.has(payerId)) {
        return;
      }

      const participantIds = Array.isArray(expense.participants)
        ? Array.from(new Set(expense.participants.map(String))).filter((id) =>
            validIds.has(id)
          )
        : [];

      if (participantIds.length === 0) {
        return;
      }

      const description =
        typeof expense.description === "string" && expense.description.trim()
          ? expense.description.trim()
          : "Gasto sin descripción";

      const createdAt =
        typeof expense.createdAt === "number" && Number.isFinite(expense.createdAt)
          ? expense.createdAt
          : Date.now();

      const id =
        typeof expense.id === "string" && expense.id.trim()
          ? expense.id
          : createId();

      sanitized.push({
        id,
        description,
        amount,
        payerId,
        participants: participantIds,
        createdAt,
      });
    });

    sanitized.sort((a, b) => b.createdAt - a.createdAt);
    return sanitized;
  }

  function formatExportDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
      date.getHours()
    )}${pad(date.getMinutes())}`;
  }

  function formatCurrency(value) {
    return formatter.format(value);
  }

  function getParticipantName(id) {
    return state.participants.find((participant) => participant.id === id)?.name;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          participants: state.participants,
          expenses: state.expenses,
        })
      );
    } catch (error) {
      console.warn("No se pudo guardar en localStorage", error);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      state.participants = Array.isArray(parsed.participants)
        ? parsed.participants
        : [];
      state.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    } catch (error) {
      console.warn("No se pudieron cargar los datos guardados", error);
    }
  }

  init();
})();
