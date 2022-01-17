import React from "react";
import {useEffect, useState} from "react";
import axios from "axios";
import {useStorage} from "../contexts/storageContext";
import {ReactSelectType} from "../types/reactSelectType";
import {Vest} from "../types/Vest";
import Select from "react-select";
import {ActionMeta, InputActionMeta, SingleValue} from "react-select";

const ListVests = (props: any) => {

    // Make the RPC call here.
    // I hope phantom supports this way of making submissions ...
    const [VestList, setVestList] = useState<Vest[]>([]);
    const [VestSelectOptions, setVestSelectOptions] = useState<ReactSelectType[]>([]);
    const [selectedOption, setSelectedOption] = useState<ReactSelectType>({value: "", label: ""});
    const storageProvider = useStorage();
    console.log("storage provider in list vests", storageProvider);
    console.log("selected option", selectedOption);

    // const handleDecisionChange = (_selectedOption: ReactSelectType) => {
    //     console.log("Handling decision to :", _selectedOption);
    //     setSelectedOption(prev => _selectedOption);
    // };

    const handleChange = (newValue: SingleValue<ReactSelectType>, actionMeta: ActionMeta<ReactSelectType>) => {
        console.log("Handling decision to :", newValue);
        // let _selectedOption: ReactSelectType = VestSelectOptions.find(item => item.value == newValue)!;
        let _newValue = newValue;
        if (_newValue) {
            setSelectedOption(prev => _newValue!);
        }
    };

    const handleInputChange = (newValue: string, actionMeta: InputActionMeta) => {
        console.log("Handling decision to :", newValue);
        let _selectedOption: ReactSelectType | undefined = VestSelectOptions.find(item => item.value == newValue);
        console.log("Selected option is: ");
        if (_selectedOption) {
            setSelectedOption(prev => _selectedOption!);
        }
    };

    useEffect(() => {
        setVestSelectOptions(prev => {
            return VestList.map((VestObj: Vest) => {
                console.log("Vest object is: ", VestObj);
                let out: ReactSelectType = {
                    value: VestObj.seed,
                    label: VestObj.seed
                };
                return out;
            })
        })
    }, [VestList]);

    useEffect(() => {
        let selectedVestObject: any = VestList
            .find((VestObj: any) => VestObj.seed === selectedOption.value);
        console.log("Selected Vest Object is: ", selectedVestObject);
        storageProvider.setSelectedVest((_: any) => selectedVestObject);
    }, [selectedOption]);

    const getVestList = async () => {
        let request_body = {};

        try {
            let Vest_list_db_response = await axios({
                method: 'get',
                url: 'http://127.0.0.1:4387/api/vest',
                data: request_body
            });
            console.log("Response from getting Vest's in pool in the database is: ", Vest_list_db_response);

            // Save this into the VestList
            setVestList((_: any) => {
                return Vest_list_db_response.data;
            });

        } catch (error) {
            console.log("Error making request");
            console.log(JSON.stringify(error));
        }
    }

    useEffect(() => {
        getVestList();
    }, []);

    useEffect(() => {
        console.log("Vest Select Options are");
        console.log(VestSelectOptions);
    }, [VestSelectOptions]);

    // const programId: string = "5bcVGSYUFA2AKvweh3V5mg9zGjweioQQVvk18UCYjTR1";

    // inputValue={selectedOption}

    // @ts-ignore
    const selectOptions = <Select
        // onInputChange={() => {}}
        onChange={handleChange}
        options={VestSelectOptions}
        defaultValue={VestSelectOptions[0]}
        // onMenuClose={() => {}}
        // onMenuOpen={() => {}}
        // value={selectedOption.value}
        // inputValue={selectedOption.value}
        isMulti={false}
        isClearable={false}
        isSearchable={false}
    />

    return (
        <>
            {"List of Vests are:"}
            {selectOptions}

            {/*<ul>*/}
            {/*    {VestList.map((VestItem: any) => {*/}
            {/*        let displayItem = JSON.stringify(VestItem)*/}
            {/*        return (*/}
            {/*            <li>*/}
            {/*                {displayItem}*/}
            {/*            </li>*/}
            {/*        )*/}
            {/*    })}*/}
            {/*</ul>*/}
        </>
    );
};

export default ListVests;