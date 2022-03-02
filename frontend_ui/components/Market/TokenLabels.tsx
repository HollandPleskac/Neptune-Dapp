import Label from './Label';

const TokenLabels = ({ isLend, sortFn, sortInfo }: Props) => {
  const labels = [
    {
      name: 'Token',
      widthClasses: 'w-[164px] pl-6',
      field: 'name',
    },
    {
      name: `${isLend ? 'Lend' : 'Borrow'} APY`,
      widthClasses: 'w-[116px]',
      field: 'APY',
    },
    {
      name: 'Rewards APR',
      widthClasses: 'flex-1',
      field: 'rewardsAPR',
    },
    {
      name: `Total ${isLend ? 'Lent' : 'Borrowed'} `,
      widthClasses: 'justify-end mr-6',
      field: 'totalAmount',
    },
  ];

  return (
    <div className='flex mb-4'>
      {labels.map((label, i) => (
        <Label
          key={i}
          name={label.name}
          widthClasses={label.widthClasses}
          field={label.field}
          sortFn={sortFn}
          sortInfo={sortInfo}
        />
      ))}
    </div>
  );
};

type Props = {
  isLend: boolean;
  sortFn: (field: string) => void;
  sortInfo: SortInformation;
};

export default TokenLabels;
