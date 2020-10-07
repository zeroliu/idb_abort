function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('idb-navigation-abort-test');
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      db.createObjectStore('entries', {autoIncrement: true});
    });
    request.addEventListener('success', () => {
      const db = request.result;
      db.addEventListener('versionchange', () => {
        db.close();
      });
      resolve(db);
    });
    request.addEventListener('error', () => {
      reject(request.error);
    });
  });
}

function addData(store, iter) {
  if (iter > 100000) {
    return;
  }
  const request = store.add('data');
  request.addEventListener('success', () => {
    addData(store, iter + 1);
  });
  request.addEventListener('error', () => {
    console.log(`request ${iter} failed`);
  });
}

async function run() {
  window.addEventListener('unload', (e) => {
    console.log(e);
  });
  document.getElementById('startBtn').textContent = 'running...';
  const db = await openDb();
  try {
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    addData(store, 0);
    tx.addEventListener('complete', () => {
      document.getElementById('startBtn').textContent = 'Start again';
      console.log('Transaction completed');
    });
    tx.addEventListener('error', (evt) => {
      console.log(`transaction error handler called with event target ${
          evt.target.constructor.name}. Transaction error: ${tx.error}`);
    });
    tx.addEventListener('abort', (evt) => {
      console.log(`transaction abort handler called with event target ${
          evt.target.constructor.name}. Transaction error: ${tx.error}`);
    });
  } catch (e) {
    console.log('caught error');
    console.log(e);
  }
}

document.getElementById('startBtn').addEventListener('click', run);
