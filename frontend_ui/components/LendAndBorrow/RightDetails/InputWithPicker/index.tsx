import ImageDropdown from 'components/common/ImageDropdown';

const InputWithPicker = ({
  placeholder,
  onChange,
  inputType = 'text',
}: Props) => {
  return (
    <div className='flex w-full mt-4'>
      <ImageDropdown />
      <input
        className='rounded-tr-lg rounded-br-lg border border-gray-fadedMore bg-transparent text-white placeholder-gray p-4 w-full text-2xl leading-7 font-bold placeholder:text-white'
        onChange={onChange}
        placeholder={placeholder}
        type={inputType}
      />
    </div>
  );
};

type Props = {
  placeholder: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputType?: string;
};

export default InputWithPicker;
