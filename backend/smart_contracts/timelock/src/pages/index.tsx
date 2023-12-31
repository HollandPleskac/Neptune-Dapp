import type { NextPage } from "next";
import Head from "next/head";
import { HomeView } from "../views";
import {useState} from 'react';
import styles from '../styles/Home.module.css';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import InitializeLockForm  from '../components/InitializeLockForm';
import InitializeUnlockForm from '../components/InitializeUnlockForm';
import VestingInfoForm from '../components/VestingInfoForm'
import GetUserVotingPowerForm from '../components/GetUserVotingPowerForm'
import GetProtocolVotingPowerForm from '../components/GetProtocolVotingPowerForm'
import {Col, Container, Row } from "react-bootstrap";
import { ClassNames } from "@emotion/react";
import ListVests from '../components/ListVests'
import DisplaySelectedVest from '../components/DisplaySelectedVest'
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import MuiInput from '@mui/material/Input';
import { styled } from '@mui/material/styles';


const Home: NextPage = (props) => {

  const Input = styled(MuiInput)`
  width: 42px;
  `;

  const [value, setValue] = useState(30);

  const handleChange = (event: any, newValue: any) => {
    setValue(newValue);
  };

  const handleInputChange = (event: any) => {
    setValue(Number(event.target.value));
  };

  const handleBlur = () => {
    if (value < 0) {
      setValue(0);
    } else if (value > 4) {
      setValue(4);
    }
  };

  const [amount, setAmount] = useState();
  const handleAmountChange = (event:any) => {
    setAmount(event.target.value);
  }


  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <HomeView />

      <main className={styles.main}>

      <Container>
          1. Choose a duration to lock tokens for.\n\n
      </Container>
      <Container>
        <Box sx={{ width: 1500 }}>
        <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
          <Slider 
          min={0} 
          max={4} 
          step={0.0000001} 
          value={value} 
          onChange={handleChange}
          valueLabelDisplay='on' />
        </Stack>
      </Box>
     </Container>

     <Container>
     <Box sx={{ width: 250 }}>
      <Typography id="input-slider" gutterBottom>
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
        </Grid>
        <Grid item xs>
          <Slider
            min={0}
            max={4}
            step={0.0001}
            value={typeof value === 'number' ? value : 0}
            onChange={handleChange}
            aria-labelledby="input-slider"
          />
        </Grid>
        <Grid item>
          <Input
            value={value}
            size="small"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: 0.0001,
              min: 0,
              max: 4,
              type: 'number',
              'aria-labelledby': 'input-slider',
            }}
          />
        </Grid>
      </Grid>
    </Box>
     </Container> 


    <Container>
    2. Choose an amount of Neptune tokens to lock. 
    <Box
      component="form"
      sx={{
        '& > :not(style)': { m: 1, width: '25ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <TextField
        fullWidth
        id="outlined-name"
        label="Amount of tokens to lock"
        color = "secondary"
        value={amount}
        onChange={handleAmountChange}
      />
    </Box>
    </Container>
      
      <Container>
        <Row>
          <Col className={"shadow p-3 mb-5 rounded"}>
            3. Click this button to lock Neptune tokens
            <InitializeLockForm
              yearsToLock={value}
              amountToLock={amount}
            />
          </Col>  
        </Row>
      </Container>

      <Container>
        <Row>
          <Col>
          4. Select this button to unlock eligible tokens
          <InitializeUnlockForm />
          </Col>
        </Row>
      </Container>

      <Container>
        <Row>
          <Col>
          5. Use this button to print vesting account info for the connected wallet to the console.
          <VestingInfoForm />
          </Col>
        </Row>
      </Container>

      <Container>
        <Row>
          <Col>
          6. Use this button to test the on chain function to calculate user voting power. 
          <GetUserVotingPowerForm />
          </Col>
        </Row>
      </Container>

      <Container>
        <Row>
          <Col>
          6. Use this button to test the on chain function to calculate protocol voting power. 
          <GetProtocolVotingPowerForm />
          </Col>
        </Row>
      </Container>


      </main>
    </div>
  );
};

export default Home;
