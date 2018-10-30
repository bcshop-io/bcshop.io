pragma solidity ^0.4.24;

import "../common/Active.sol";
import "../common/Manageable.sol";
import "./IProductStorage.sol";
import "./AffiliateStorage.sol";
import "./IEscrowStorage.sol";

contract ProductMaker is Active {
    
    event ProductEdited
    (
        uint256 indexed productId, 
        uint256 price, 
        bool useFiatPrice,
        uint256 maxUnits,
        bool isActive,
        uint256 startTime, 
        uint256 endTime, 
        bool useEscrow,
        string name,
        string data
    );

    //
    // Storage data
    IProductStorage public productStorage; 
    IAffiliateStorage public affiliateStorage;   
    IEscrowStorage public escrowStorage;


    //
    // Methods

    constructor(
        IProductStorage _productStorage, 
        IAffiliateStorage _affiliateStorage,
        IEscrowStorage _escrowStorage
    ) 
        public 
    {
        productStorage = _productStorage;
        affiliateStorage = _affiliateStorage;
        escrowStorage = _escrowStorage;
    }  

    /**@dev Creates product. Can be called by end user.
    Affiliate parameter can set affiliate-vendor relation 
    Is should be set to cookies-stored affilate address only if sender doesn't have any products (offchain check)
    If no affiliate for this vendor, parameter should be set to 0x0
    */
    function createSimpleProduct(        
        uint256 price, 
        uint256 maxUnits,
        bool isActive,
        uint256 startTime, 
        uint256 endTime,
        bool useEscrow,   
        address escrow,
        uint256 escrowHoldTimeSeconds,                     
        bool useFiatPrice,
        address affiliate,
        string name,
        string data
    )   
        public
        activeOnly
    {
        if(useEscrow) {
            //product id will be current length
            escrowStorage.setProductEscrow(
                productStorage.getTotalProducts(), 
                escrow,
                escrowStorage.getEscrowCurrentFee(escrow),
                escrowHoldTimeSeconds
            );
        }

        //if there is no affiliate for this vendor, set it
        // if(affiliateStorage.affiliates(msg.sender) == 0x0) {
        //     //set affiliate to the vendor itself if parameter is not set
        //     affiliateStorage.setAffiliate(
        //         msg.sender, 
        //         affiliate == 0x0 ? msg.sender : affiliate
        //     );
        // }  
        if(!affiliateStorage.affiliateSet(msg.sender)) {
            affiliateStorage.setAffiliate(msg.sender, affiliate);
        }

        if(startTime > 0 && endTime > 0) {
            require(endTime > startTime, "Start/end time mismatch");
        }

        productStorage.createProduct(
            msg.sender, price, maxUnits, isActive, startTime, endTime, useEscrow, useFiatPrice, name, data
        );
    }
   
    /**@dev Edits product in the storage */   
    function editSimpleProduct(
        uint256 productId,        
        uint256 price,         
        uint256 maxUnits, 
        bool isActive, 
        uint256 startTime, 
        uint256 endTime,
        bool useFiatPrice,
        string name,
        string data
    ) 
        public
        activeOnly
    {
        require(msg.sender == productStorage.getProductOwner(productId), "Invalid caller");
        if(startTime > 0 && endTime > 0) {
            require(endTime > startTime, "Start/end time mismatch");
        }
        
        //can't change escrowUsage now
        bool useEscrow = productStorage.isEscrowUsed(productId);
        productStorage.editProduct(productId, price, maxUnits, isActive, startTime, endTime, useEscrow, useFiatPrice, name, data);        
        emit ProductEdited(productId, price, useFiatPrice, maxUnits, isActive, startTime, endTime, useEscrow, name, data);
    }

    /**@dev Changes vendor wallet for profit */
    function setVendorWallet(address wallet) public 
    activeOnly 
    {
        productStorage.setVendorInfo(msg.sender, wallet, productStorage.getVendorFee(msg.sender));
    }
}