pragma solidity ^0.4.18;

import "../common/Owned.sol";
import "./ProductStorage.sol";

contract ProductMaker is Owned {

    //
    // Events
    event ProductCreated
    (
        address indexed owner, 
        uint256 price, 
        uint256 maxUnits,
        uint256 startTime, 
        uint256 endTime, 
        bool useEscrow,
        string name,
        string data
    );



    //
    // Storage data
    IProductStorage productStorage;    


    //
    // Methods

    function ProductMaker(IProductStorage _productStorage) public {
        productStorage = _productStorage;
    }

    /**@dev Creates product. Can be called by end user */
    function createSimpleProduct(
        uint256 price, 
        uint256 maxUnits,
        bool isActive,
        uint256 startTime, 
        uint256 endTime,
        bool useEscrow,
        string name,
        string data
    ) 
        public
    {
        productStorage.createProduct(msg.sender, price, maxUnits, isActive, startTime, endTime, useEscrow, name, data);
        //ProductCreated(msg.sender, price, maxUnits, startTime, endTime, 0, name, data);
    }

    /**@dev Creates product and enters the information about vendor wallet. Can be called by end user */
    function createSimpleProductAndVendor(
        address wallet,
        uint256 price, 
        uint256 maxUnits,
        bool isActive,
        uint256 startTime, 
        uint256 endTime,
        bool useEscrow,
        string name,
        string data
    ) 
        public
    {
        productStorage.setVendorInfo(msg.sender, wallet, productStorage.getVendorFee(msg.sender));   
        productStorage.createProduct(msg.sender, price, maxUnits, isActive, startTime, endTime, useEscrow, name, data);
        //ProductCreated(msg.sender, price, maxUnits, startTime, endTime, 0, name, data);
    }

    /**@dev Edits product in the storage */   
    function editSimpleProduct(
        uint256 productId,        
        uint256 price, 
        uint256 maxUnits, 
        bool isActive,
        uint256 soldUnits,      
        uint256 startTime, 
        uint256 endTime,
        bool useEscrow,
        string name,
        string data
    ) 
        public    
    {
        require(msg.sender == productStorage.getProductOwner(productId));
        productStorage.editProduct(productId, price, maxUnits, isActive, soldUnits, startTime, endTime, useEscrow, name, data);        
    }

    /**@dev Changes vendor wallet for profit */
    function setVendorWallet(address wallet) public {
        productStorage.setVendorInfo(msg.sender, wallet, productStorage.getVendorFee(msg.sender));
    }
}