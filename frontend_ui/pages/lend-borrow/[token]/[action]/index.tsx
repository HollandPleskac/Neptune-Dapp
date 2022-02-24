import type { NextPage } from 'next';
import { useRouter } from 'next/router';

const LendBorrow: NextPage = () => {
  const router = useRouter();

  return (
    <div>
      <h1>Lend Borrow</h1>
      <h2>Token: {router.query.token}</h2>
      <h2>Token: {router.query.action}</h2>
    </div>
  );
};

export default LendBorrow;
