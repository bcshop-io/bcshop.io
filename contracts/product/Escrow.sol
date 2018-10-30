pragma solidity ^0.4.24;

import "../common/Active.sol";
import "../common/Manageable.sol";
import "../common/UsePermille.sol";
import "./IEscrowStorage.sol";

/**dev Escrow-related information provider. Users can also register as escrow here */
contract Escrow is Manageable, UsePermille, Active {


    //
    // Events

    event EscrowActivated(address indexed escrow, bool state);
    event ParamsChanged(address defaultEscrow, uint256 legacyHoldTime, uint16 legacyEscrowFee);


    //
    // Storage data    

    IEscrowStorage public escrowStorage;

    //hold time in seconds applied to legacy products with no escrow records
    uint256 public legacyHoldTime;
    //fee [1-1000] applied to legacy products that with no escrow records
    uint16 public legacyEscrowFee;    

    //escrow used by default (platform)
    address public defaultEscrow;

    //
    // Modifiers



    //
    // Methods

    constructor(
        IEscrowStorage _escrowStorage,
        address _defaultEscrow,
        uint256 _legacyHoldTimeSeconds,
        uint16 _legacyEscrowFee
    ) 
        public 
    {
        escrowStorage = _escrowStorage;
        setParams(_defaultEscrow, _legacyHoldTimeSeconds, _legacyEscrowFee);
    }


    /**@dev Returns true if product has no escrow record. 
    IMPORTANT: Doesn't check if it has ProductStorage-set flag 'useEscrow' */
    function usesLegacyEscrow(uint256 productId) public view returns(bool) {
        return escrowStorage.getProductEscrow(productId) == 0x0;
    }


    /**@dev Returns true if product's escrow is inactive or banned */
    function usesInactiveEscrow(uint256 productId) public view returns(bool) {
        address escrow = escrowStorage.getProductEscrow(productId);
        return 
            escrow != 0x0 && 
            (!escrowStorage.isEscrowActive(escrow) || escrowStorage.isEscrowBanned(escrow));
    }

    /**@dev Returns escrow of the product specified by its id. Makes sense only if product uses ecsrow
    Returns default escrow if
    1. there is no escrow record
    2. escrow is in inactive isActive
    Otherwise return escrow record */
    function getProductEscrow(uint256 productId)
        public 
        view
        returns (address) 
    {
        if(usesLegacyEscrow(productId) || usesInactiveEscrow(productId)) {
            return defaultEscrow;
        } else {
            return escrowStorage.getProductEscrow(productId);
        }
    }


    /**@dev Returns escrow fee of the product specified by its id. Makes sense only if product uses ecsrow */
    function getProductEscrowFee(uint256 productId) 
        public 
        view 
        returns(uint16) 
    {
        if(usesLegacyEscrow(productId)) {
            return legacyEscrowFee;
        } else {
            return escrowStorage.getProductEscrowFee(productId);
        }
    }


    /**@dev Returns escrow hold time of the product specified by its id. Makes sense only if product uses ecsrow */
    function getProductEscrowHoldTime(uint256 productId) 
        public 
        view 
        returns(uint256) 
    {
        if(usesLegacyEscrow(productId)) {
            return legacyHoldTime;
        } else {
            return escrowStorage.getProductEscrowHoldTime(productId);
        }
    }

    
    /**@dev Register as escrow or edit fee [1-1000]*/
    function update(uint16 feePermille) 
        public 
        activeOnly 
    {
        if(escrowStorage.isEscrow(msg.sender)) {
            //if there is already such record in escrow storage, update it, but don't change the state
            escrowStorage.editEscrow(
                msg.sender, 
                escrowStorage.isEscrowActive(msg.sender), 
                feePermille
            );
        } else {
            escrowStorage.addEscrow(msg.sender, feePermille);
        }
    }


    /**@dev Stops being escrow if state is false, otherwise start being escrow again  */
    function activate(bool state) public activeOnly {
        escrowStorage.editEscrow(msg.sender, state, escrowStorage.getEscrowCurrentFee(msg.sender));
        emit EscrowActivated(msg.sender, state);
    }

    
    function setParams(
        address _defaultEscrow,
        uint256 _legacyHoldTimeSeconds,
        uint16 _legacyEscrowFee
    )
        public
        managerOnly
        validPermille(_legacyEscrowFee)
    {
        require(escrowStorage.isEscrow(_defaultEscrow));

        defaultEscrow = _defaultEscrow;
        legacyHoldTime = _legacyHoldTimeSeconds;
        legacyEscrowFee = _legacyEscrowFee;

        emit ParamsChanged(_defaultEscrow, _legacyHoldTimeSeconds, _legacyEscrowFee);
    }
}