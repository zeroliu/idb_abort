const TEST_DB_NAME = 'test-database';
const testCases = {
  addSameKeyTwice: {
    expect: {
      errorEventTarget: 'IDBRequest',
      errorTransactionError: '',
      abortEventTarget: 'IDBTransaction',
      abortTransactionError:
          'ConstraintError: Key already exists in the object store.',
    },
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
    expect: {
      errorEventTarget: 'IDBRequest',
      errorTransactionError: '',
      abortEventTarget: 'IDBTransaction',
      abortTransactionError:
          `ConstraintError: Unable to add key to index 'name': at least one key does not satisfy the uniqueness requirements.`,
    },
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
const testResultStatusEl = document.querySelector('.test-result-status');

const testButtons = document.querySelectorAll('.test-btn');
testButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    runTest(btn.name);
  });
});

userAgentEl.textContent = navigator.userAgent;
function reset() {
  return new Promise(resolve => {
    errorEventTargetNameEl.textContent = '';
    abortEventTargetNameEl.textContent = '';
    errorTransactionErrorEl.textContent = '';
    abortTransactionErrorEl.textContent = '';
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

function processTransaction(tx, expect) {
  const result = {
    errorEventTarget: 'not called',
    abortEventTarget: 'not called',
    errorTransactionError: 'not called',
    abortTransactionError: 'not called',
  };
  renderResult(result);

  tx.onerror = (ev) => {
    result.errorEventTarget = ev.target.constructor.name;
    result.errorTransactionError = tx.error ? tx.error.toString() : '';
    console.log(ev);
  };
  tx.onabort = (ev) => {
    result.abortEventTarget = ev.target.constructor.name;
    result.abortTransactionError = tx.error ? tx.error.toString() : '';
    console.log(ev);

    renderResult(result);
    compareResult(result, expect);
  };
}

function renderResult(result) {
  errorEventTargetNameEl.textContent = result.errorEventTarget;
  errorTransactionErrorEl.textContent = result.errorTransactionError;
  abortEventTargetNameEl.textContent = result.abortEventTarget;
  abortTransactionErrorEl.textContent = result.abortTransactionError;
}

function compareResult(result, expect) {
  if (expect.errorTransactionError === result.errorTransactionError &&
      expect.abortTransactionError === result.abortTransactionError &&
      expect.errorEventTarget === result.errorEventTarget &&
      expect.abortEventTarget === result.abortEventTarget) {
    testResultStatusEl.textContent = 'PASS';
    testResultStatusEl.classList.add('pass');
  } else {
    testResultStatusEl.textContent = 'FAIL';
    testResultStatusEl.classList.add('fail');
    console.log(
        `expect ${JSON.stringify(expect)}, but got ${JSON.stringify(result)}`);
  }
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
      processTransaction(tx, testCase.expect);
    });
  });
}
