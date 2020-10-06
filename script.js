const TEST_DB_NAME = 'test-database';
const NOT_CALLED = 'not called';
const ABORT_ERROR = 'AbortError';
const TRANSACTION_ERROR = 'TransactionError'

const testCases = {
  addSameKeyTwice: {
    description: 'Bad requests - Add the same key twice',
    expected: TRANSACTION_ERROR,
    upgrade: (db) => {
      db.createObjectStore('entries');
    },
    test: (db) => {
      const tx = db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      store.add('foo', 1);
      store.add('bar', 1);
      return tx;
    }
  },
  addUniqueIndexTwice: {
    description:
        'Bad requests - Put the same index key when the key has a uniqueness constraint',
    expected: TRANSACTION_ERROR,
    upgrade: (db) => {
      const store = db.createObjectStore('entries');
      store.createIndex('name', 'name', {unique: true});
    },
    test: (db) => {
      const tx = db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      store.add({name: 'foo'}, 1);
      store.add({name: 'foo'}, 2);
      return tx;
    }
  },
  explicitAbort: {
    description: 'An explicit abort() call',
    expected: ABORT_ERROR,
    upgrade: (db) => {
      db.createObjectStore('entries');
    },
    test: (db) => {
      const tx = db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      store.add('foo', 1);
      tx.abort();
      return tx;
    }
  },
  uncaughtExceptionInSuccessRequest: {
    description: `An uncaught exception in the request's success handler`,
    expected: TRANSACTION_ERROR,
    upgrade: (db) => {
      db.createObjectStore('entries');
    },
    test: (db) => {
      const tx = db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      const request = store.add('foo', 1);
      request.addEventListener('success', () => {
        throw new Error('throw in request success handler');
      });
      return tx;
    }
  },
  uncaughtExceptionInErrorRequest: {
    description: `An uncaught exception in the request's error handler`,
    expected: TRANSACTION_ERROR,
    upgrade: (db) => {
      db.createObjectStore('entries');
    },
    test: (db) => {
      const tx = db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      store.add('foo', 1);
      const request = store.add('bar', 1);
      request.addEventListener('error', () => {
        throw new Error('throw in request error handler');
      });
      return tx;
    }
  },
}

const userAgentEl = document.getElementById('userAgent');
const errorEventTargetNameEl =
    document.querySelector('.error-event-target-name');
const abortEventTargetNameEl =
    document.querySelector('.abort-event-target-name');
const errorTransactionErrorEl =
    document.querySelector('.error-transaction-error');
const abortTransactionErrorEl =
    document.querySelector('.abort-transaction-error');
const errorEventErrorEl = document.querySelector('.error-event-error');
const testResultStatusEl = document.querySelector('.test-result-status');

generateTestCaseUI();
userAgentEl.textContent = navigator.userAgent;


function generateTestCaseUI() {
  const container = document.querySelector('.test-cases');
  for (const key of Object.keys(testCases)) {
    const testCase = testCases[key];
    const el = document.createElement('div');
    el.className = 'test-case';
    el.innerHTML = `
      <button class="test-btn">TEST</button>
      ${
        testCase
            .description} (Expected: <span class="test-result-status result">${
        testCase.expected}</span>)
    `;
    const button = el.querySelector('.test-btn');
    button.addEventListener('click', () => {
      runTest(key);
    });
    container.appendChild(el);
  }
}

function reset() {
  return new Promise(resolve => {
    errorEventTargetNameEl.textContent = '';
    abortEventTargetNameEl.textContent = '';
    errorTransactionErrorEl.textContent = '';
    abortTransactionErrorEl.textContent = '';
    errorEventErrorEl.textContent = '';
    testResultStatusEl.textContent = '';
    testResultStatusEl.className = 'test-result-status';

    const request = indexedDB.deleteDatabase(TEST_DB_NAME);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

function processTransaction(tx) {
  const result = {
    errorEventTarget: NOT_CALLED,
    abortEventTarget: NOT_CALLED,
    errorTransactionError: NOT_CALLED,
    abortTransactionError: NOT_CALLED,
    errorEventError: NOT_CALLED,
  };
  renderResult(result);

  tx.onerror = (ev) => {
    result.errorEventTarget = ev.target.constructor.name;
    result.errorTransactionError = tx.error ? tx.error.toString() : '';
    result.errorEventError = ev.target.error ? ev.target.error.toString() : '';
    console.log(ev);
  };
  tx.onabort = (ev) => {
    result.abortEventTarget = ev.target.constructor.name;
    result.abortTransactionError = tx.error ? tx.error.toString() : '';
    console.log(ev);

    renderResult(result);
    evaluateResult(result);
  };
}

function renderResult(result) {
  errorEventTargetNameEl.textContent = result.errorEventTarget;
  errorTransactionErrorEl.textContent = result.errorTransactionError;
  errorEventErrorEl.textContent = result.errorEventError;
  abortEventTargetNameEl.textContent = result.abortEventTarget;
  abortTransactionErrorEl.textContent = result.abortTransactionError;
}

function evaluateResult(result) {
  if ((!result.errorTransactionError ||
       result.errorEventTarget !== 'IDBTransaction') &&
      !result.abortTransactionError) {
    testResultStatusEl.textContent = ABORT_ERROR;
  } else {
    testResultStatusEl.textContent = TRANSACTION_ERROR;
  }
  testResultStatusEl.classList.add('result');
}

function openDb(upgrade) {
  const request = indexedDB.open(TEST_DB_NAME);
  request.addEventListener('upgradeneeded', upgrade);
  request.addEventListener('success', () => {
    const db = request.result;
    db.addEventListener('versionchange', () => {
      db.close();
    });
  });
  return request;
}

function runTest(name) {
  const testCase = testCases[name];

  reset().then(() => {
    const openRequest = openDb((evt) => {
      testCase.upgrade(evt.target.result);
    });
    openRequest.addEventListener('success', (evt) => {
      const tx = testCase.test(evt.target.result);
      processTransaction(tx);
    });
  });
}
