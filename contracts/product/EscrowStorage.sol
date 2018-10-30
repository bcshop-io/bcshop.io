pragma solidity ^0.4.24;

import "./IEscrowStorage.sol";
import "../common/Manageable.sol";
import "../common/UsePermille.sol";

contract EscrowStorage is IEscrowStorage, UsePermille, Manageable {
 
 
    //
    //Inner types

    //Escrow information: current fee, flag if it's active, flag if it's set
    struct EscrowInfo {
        uint16 currentFee;
        bool isActive;
        bool isBanned;
        bool isSet;
    }

    //Product-related information: escrow, fee and hold time in seconds
    struct ProductEscrowInfo {
        address escrow;
        uint16 fee;
        uint256 holdTimeSeconds;
    }    


    //
    // Events
    event NewEscrowSet(address indexed escrow, uint16 fee);
    event EscrowChanged(address indexed escrow, bool isActive, uint16 fee);
    event EscrowBanned(address indexed escrow, bool state);
    event ProductEscrowSet(uint256 indexed productId, address indexed escrow);


    //
    // Storage data    
    
    //array of escrow information units
    address[] public escrowAgent;
    //user address -> index in escrows array if it's escrow
    mapping(address => EscrowInfo) public escrowInfo;
    //product id => escrow-related info
    mapping(uint256 => ProductEscrowInfo) productInfo;    

    

    //
    // Modifiers

    modifier validEscrow(address escrow) {
        require(escrowInfo[escrow].isSet);
        _;
    }

    modifier activeEscrow(address escrow) {
        require(escrowInfo[escrow].isActive);
        _;
    }


    //
    // Methods

    constructor(address[] escrows, uint16[] fees) public {
        require(escrows.length < 5 && escrows.length == fees.length);

        for(uint8 i = 0; i < escrows.length; ++i) {
            addEscrow(escrows[i], fees[i]);
        }
    }

    /**@dev returns true if given escrow address was registered as escrow, regardless if it is active now */
    function isEscrow(address escrow) public view returns (bool) {
        return escrowInfo[escrow].isSet;
    }

    /**@dev returns true if given escrow address is active now */
    function isEscrowActive(address escrow) public view returns (bool) {
        return escrowInfo[escrow].isActive;
    }

    /**@dev returns true if given escrow address is banned now */
    function isEscrowBanned(address escrow) public view returns (bool) {
        return escrowInfo[escrow].isBanned;
    }

    /**@dev Returns current fee [1-1000] of specified escrow */
    function getEscrowCurrentFee(address escrow) public view returns(uint16) {
        return escrowInfo[escrow].currentFee;
    }

    /**@dev returns total number of escrow agents both active and inactive */
    function getTotalEscrowAgents() 
        public 
        view 
        returns (uint256) 
    {
        return escrowAgent.length;
    }

    /**@dev returns information about escrow specified by zero-based index in escrows array */
    function getEscrowInfo(uint256 index) public view returns(address, bool, bool, uint16) {
        address escrow = escrowAgent[index];
        return (escrow, escrowInfo[escrow].isActive, escrowInfo[escrow].isBanned, escrowInfo[escrow].currentFee);
    }

    /**@dev Returns escrow of the product specified by its id. Makes sense only if product uses ecsrow*/
    function getProductEscrow(uint256 productId)
        public 
        view
        returns (address) 
    {
        return productInfo[productId].escrow;
    }

    /**@dev Returns escrow fee of the product specified by its id. Makes sense only if product uses ecsrow */
    function getProductEscrowFee(uint256 productId) 
        public 
        view 
        returns(uint16) 
    {
        return productInfo[productId].fee;
    }

    /**@dev Returns escrow hold time of the product specified by its id. Makes sense only if product uses ecsrow */
    function getProductEscrowHoldTime(uint256 productId) 
        public 
        view 
        returns(uint256) 
    {
        return productInfo[productId].holdTimeSeconds;
    }

    /**
    @dev Creates new EscrowInfo record.
    escrow - user's address,
    feePermille - fee permille [0-1000] */
    function addEscrow(address escrow, uint16 feePermille) 
        public 
        managerOnly 
        validPermille(feePermille)
    {
        require(!escrowInfo[escrow].isSet);

        escrowInfo[escrow].isSet = true;
        escrowInfo[escrow].isActive = true;
        escrowInfo[escrow].currentFee = feePermille;
        escrowAgent.push(escrow);

        emit NewEscrowSet(escrow, feePermille);
    }     


    /**
    @dev Edits escrow information. 
    escrow - user's address,
    isActive - true if escrow is active, otherwise false,
    feePermille - fee permille [0-1000]  */
    function editEscrow(address escrow, bool isActive, uint16 feePermille) 
        public 
        managerOnly 
        validEscrow(escrow)
        validPermille(feePermille)
    {
        escrowInfo[escrow].isActive = isActive;
        escrowInfo[escrow].currentFee = feePermille;

        emit EscrowChanged(escrow, isActive, feePermille);
    }

    /**@dev Bans escrow, sets ban flag equal to 'state'  */
    function banEscrow(address escrow, bool state) 
        public 
        managerOnly 
        validEscrow(escrow)
    {
        escrowInfo[escrow].isBanned = state;
        emit EscrowBanned(escrow, state);
    }


    /** 
    @dev sets escrow info for specified product */ 
    function setProductEscrow(uint256 productId, address escrow, uint16 escrowFee, uint256 holdTimeSeconds) 
        public 
        managerOnly
        validEscrow(escrow)
        activeEscrow(escrow)
        validPermille(escrowFee)
    {
        productInfo[productId].escrow = escrow;
        productInfo[productId].fee = escrowFee;
        productInfo[productId].holdTimeSeconds = holdTimeSeconds;

        emit ProductEscrowSet(productId, escrow);
    }
}