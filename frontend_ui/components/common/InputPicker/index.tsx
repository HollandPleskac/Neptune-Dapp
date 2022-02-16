const InputPicker = ({ placeholder }: Props) => {
  return (
    <div className="flex w-full mt-4">
      <select className="rounded-tl-lg rounded-bl-lg border border-r-0 border-gray-fadedMore bg-transparent p-4">
        <option>SOL</option>
        <option>NEP</option>
      </select>
      <input
        className="rounded-tr-lg rounded-br-lg border border-gray-fadedMore bg-transparent text-white placeholder-gray p-4 w-full text-2xl leading-7 font-bold placeholder:text-white"
        placeholder={placeholder}
      />
    </div>
  );
};

type Props = {
  placeholder: string;
};

export default InputPicker;
