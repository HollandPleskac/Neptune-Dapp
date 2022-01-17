import React from "react";
import {useEffect, useState} from "react";
import {useStorage} from "../contexts/storageContext";

const DisplaySelectedVest = (props: any) => {

    // Make the RPC call here.
    // I hope phantom supports this way of making submissions ...
    const storageProvider = useStorage();
    const [showVest, setShowVest] = useState<any>({});

    useEffect(() => {
        setShowVest((prev: any) => storageProvider.selectedVest);
    }, [storageProvider, storageProvider.selectedVest]);

    return (
        <>
            {/*{"Selected Vest is:"}*/}
            {JSON.stringify(showVest, null, '\n')}
        </>
    );
};

export default DisplaySelectedVest;