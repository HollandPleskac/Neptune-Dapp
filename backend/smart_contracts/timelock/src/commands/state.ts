import { PublicKey, Struct } from '@solana/web3.js';
import { deserialize } from 'v8';
import { Numberu64, Numberu32 } from './utils';
import { deserialize as borsh_deserialize } from 'borsh'

export class Schedule {
  // Release time in unix timestamp
  releaseTime!: Numberu64;
  amount!: Numberu64;

  constructor(releaseTime: Numberu64, amount: Numberu64) {
    this.releaseTime = releaseTime;
    this.amount = amount;
  }

  public toBuffer(): Buffer {
    return Buffer.concat([this.releaseTime.toBuffer(), this.amount.toBuffer()]);
  }

  static fromBuffer(buf: Buffer): Schedule {
    const releaseTime: Numberu64 = Numberu64.fromBuffer(buf.slice(0, 8));
    const amount: Numberu64 = Numberu64.fromBuffer(buf.slice(8, 16));
    return new Schedule(releaseTime, amount);
  }
}

export class VestingScheduleHeader {
  destinationAddress!: PublicKey;
  mintAddress!: PublicKey;
  isInitialized!: boolean;

  constructor(
    destinationAddress: PublicKey,
    mintAddress: PublicKey,
    isInitialized: boolean,
  ) {
    this.destinationAddress = destinationAddress;
    this.mintAddress = mintAddress;
    this.isInitialized = isInitialized;
  }

  static fromBuffer(buf: Buffer): VestingScheduleHeader {
    const destinationAddress = new PublicKey(buf.slice(0, 32));
    const mintAddress = new PublicKey(buf.slice(32, 64));
    const isInitialized = buf[64] == 1;
    const header: VestingScheduleHeader = {
      destinationAddress,
      mintAddress,
      isInitialized,
    };
    return header;
  }
}

export class ContractInfo {
  destinationAddress!: PublicKey;
  mintAddress!: PublicKey;
  schedules!: Array<Schedule>;

  constructor(
    destinationAddress: PublicKey,
    mintAddress: PublicKey,
    schedules: Array<Schedule>,
  ) {
    this.destinationAddress = destinationAddress;
    this.mintAddress = mintAddress;
    this.schedules = schedules;
  }

  static fromBuffer(buf: Buffer): ContractInfo | undefined {
    const header = VestingScheduleHeader.fromBuffer(buf.slice(0, 65));
    if (!header.isInitialized) {
      return undefined;
    }
    const schedules: Array<Schedule> = [];
    for (let i = 65; i < buf.length; i += 16) {
      schedules.push(Schedule.fromBuffer(buf.slice(i, i + 16)));
    }
    return new ContractInfo(
      header.destinationAddress,
      header.mintAddress,
      schedules,
    );
  }
}

class Primitive {
  pointMap!: Map<number,Point>

  constructor(
    pointMap: Map<number,Point>
  ) {
    this.pointMap = pointMap
  }
}

export class Point {
  slope!: number;
  bias!: number;
  dslope!: number;

  constructor(
    slope: number,
    bias: number,
    dslope: number,
  ) {
    this.slope = slope;
    this.bias= bias;
    this.dslope = dslope;
  }
}

//bruh, for some reason, the borsh deserialization is unpacking the data in a super weird format
//I don't think its a problem, since all the data is there, but its annoying. 
//it goes like this to get to the map
//deser['pointMap']['pointMap']
//then each point is formatted weird too. All the data is stored in the slope. So if you want
//to get the bias of the point that's at index 1234, you use.
//deser['pointMap']['pointMap'].get(1234).slope.bias.toNumber()
export function unpackCalendar(buf: Buffer): any {
  const schema = new Map<Function, any>([
    [Primitive, 
      { kind: 'struct', fields: [
          ['pointMap', { 
            kind: 'map', key: 'u32', value: Point 
          }]
      ]}
    ],
    [Point,
      {kind: 'struct', fields: [
        ['slope', 'u128'],
        ['bias', 'u128'],
        ['dslope','u128']
      ]}
    ]
  ]);
  const deser = borsh_deserialize(schema, Primitive, buf);
  const map = deser['pointMap'];
  return 
}