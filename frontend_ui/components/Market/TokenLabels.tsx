const TokenLabels = ({ isLend, sortFn }: Props) => {
  const labels = [
    {
      name: 'Token',
      className: 'w-3/12 mr-6 text-sm text-gray-faded cursor-pointer',
      field: 'name',
    },
    {
      name: `${isLend ? 'Lend' : 'Borrow'} APY`,
      className: 'w-2/12 text-sm text-gray-faded cursor-pointer',
      field: 'APY',
    },
    {
      name: 'Rewards APR',
      className: 'flex-1 text-sm text-gray-faded cursor-pointer',
      field: 'rewardsAPR',
    },
    {
      name: `Total ${isLend ? 'Lent' : 'Borrowed'} `,
      className: 'flex justify-end mr-6 text-sm text-gray-faded cursor-pointer',
      field: 'total',
    },
  ];

  return (
    <div className='flex mb-4'>
      {labels.map((label, i) => (
        <h4
          key={i}
          className={label.className}
          onClick={() => {
            sortFn(label.field);
          }}
        >
          {label.name}
        </h4>
      ))}
    </div>
  );
};

type Props = {
  isLend: boolean;
  sortFn: (field: string) => void;
};

export default TokenLabels;
