const InputPicker = ({ placeholder }: Props) => {
  return (
    <div className="flex w-full mt-4">
      <select className="rounded-tl-lg rounded-bl-lg border border-white bg-transparent p-4">
        <option>SOL</option>
        <option>NEP</option>
      </select>
      <input
        className="rounded-tr-lg rounded-br-lg border bg-transparent text-white placeholder-gray p-4 w-full"
        placeholder={placeholder}
      />
    </div>
  );
};

type Props = {
  placeholder: string;
};

export default InputPicker;
