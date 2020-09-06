const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const waitForThrowable = async (func, { interval = 5, total = 2000, count = Infinity } = {}) => {
  const end = Date.now() + total;
  let error;
  let c = 0;

  while (Date.now() < end || c < count) {
    c += 1;

    try {
      return await func();
    } catch (e) {
      error = e;
      await sleep(interval);
    }
  }

  if (error) {
    throw error;
  }
};

module.exports = waitForThrowable;
