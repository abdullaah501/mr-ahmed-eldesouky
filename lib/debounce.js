const debounce = (func, delay) => {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
  // Idempotent cancellation for lifecycle cleanup (draft persistence).
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
};

export default debounce;
