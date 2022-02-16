const PercentButtons = () => {
  const percents = ['25%', '50%', '75%', '100%'];
  return (
    <div className="flex justify-between mt-4">
      {percents.map((p, i) => (
        <button
          key={i}
          className="rounded-lg border border-gray-fadedMore text-xs text-white w-104px p-2 font-bold"
        >
          {p}
        </button>
      ))}
    </div>
  );
};

export default PercentButtons;
