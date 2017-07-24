pragma solidity ^0.4.10;

//Base class for anything that needs an owner and a way to check it
contract Owned {
    address public owner;
    modifier onlyOwner {require (owner == msg.sender); _;}
    function Owned() { owner = msg.sender; } 
}


//A kind of interface to Vendor object, stored in product as an owner 
contract VendorInformation {    
    address public vendor;
    address public provider;
    uint256 public providerFeePromille;
}


//Vendor's product for sale
//TODO add return money function
//TODO add time limit
//TODO active toggle to switch purchase access
contract Product is Owned {
        
    ///Product id
    uint256 public id;
    ///Name of the product
    string public name;     
    ///Price of one product unit
    uint256 public price;
    ///True if product has limited quantity  
    bool public isLimited;
    ///Max quantity of limited product units
    uint256 public maxQuantity;
    ///True if product can be sold in fractions, like 2.5 units
    bool public allowFractions;
    ///How many units already sold
    uint256 public soldQuantity;    
    ///List of overpays to withdraw
    mapping (address => uint256) public pendingWithdrawals; 
    ///Array of purchase information
    Purchase[] public purchases;
    ///Total amount of purchase transactions
    uint256 public totalPurchases;

    //Triggers when all payments are successfully done
    event ProductBought(address buyer, uint256 quantity, string clientId);    

    //Purchase information
    struct Purchase {
        address buyer; //who mad a purchase
        string clientId; //product-specific client id
        uint256 price; //unit price at the moment of purchase
        uint256 paidUnits; //how many units
        bool delivered; //true if Product was delivered
    }

    function Product(
        uint256 productId,
        string productName,
        uint256 unitPriceInWei, 
        bool isProductlimited, 
        uint256 maxProductQuantity, 
        bool allowProductFractions
    ) {
        id = productId;
        name = productName;
        soldQuantity = 0;
        totalPurchases = 0;
        price = unitPriceInWei * 1 wei;
        isLimited = isProductlimited;
        maxQuantity = maxProductQuantity;
        allowFractions = allowProductFractions;
    }

    /**@dev Buy product. Send ether with this function in amount equal to desirable product quantity total price
     * @param clientId Buyer's product-specific information. Contact product vendor for more information on what to specify here
     */
    function buy(string clientId) payable {
        VendorInformation vendorInfo = VendorInformation(owner);

        require (vendorInfo.vendor() != 0);

        uint256 unitsToBuy = msg.value / price;                
        if(isLimited && soldQuantity + unitsToBuy < maxQuantity)
        {
            throw;
        }
        uint256 etherToReturn = msg.value - unitsToBuy * price;
        uint256 etherToPay = msg.value - etherToReturn;

        //store overpay to withdraw later
        if(etherToReturn > 0) {
            pendingWithdrawals[msg.sender] = etherToReturn;
        }

        //check if there is something to buy
        require(unitsToBuy > 0 && etherToPay > 0);

        //how much to send to both provider and vendor
        uint256 etherToProvider = etherToPay * vendorInfo.providerFeePromille() / 1000;
        uint256 etherToVendor = etherToPay - etherToProvider;

        createPurchase(clientId, unitsToBuy);

        soldQuantity += unitsToBuy;
        
        vendorInfo.provider().transfer(etherToProvider);
        vendorInfo.vendor().transfer(etherToVendor);
        
        ProductBought(msg.sender, unitsToBuy, clientId);
    }

    /**@dev Call this to return all previous overpays */
    function withdrawOverpay() {
        uint amount = pendingWithdrawals[msg.sender];        
        pendingWithdrawals[msg.sender] = 0;

        msg.sender.transfer(amount);
    }   

    /**@dev Creates new Purchase record */
    function createPurchase(string clientId, uint256 paidCount) 
        private         
    {        
        purchases.length++;
        
        Purchase p = purchases[totalPurchases];
        p.buyer = msg.sender;
        p.clientId = clientId;
        p.price = price;
        p.paidUnits = paidCount;
        p.delivered = false;        

        totalPurchases = purchases.length;
    }
    
    /**@dev Mark purchase with given id as delivered */
    function markAsDelivered(uint256 purchaseId) {
        VendorInformation vendorInfo = VendorInformation(owner);

        require (msg.sender == vendorInfo.vendor());
        require(purchaseId < purchases.length);
        require(!purchases[purchaseId].delivered); 

        purchases[purchaseId].delivered = true;
    }    
}


//Vendor-provider agreement with the ability to create products
contract Vendor {

    //for functions that only vendor can call
    modifier onlyVendor {require(msg.sender == vendor); _;}

    event ProductCreated(address product, string name);

    address public vendor;
    address public provider;
    uint256 public providerFeePromille;

    Product[] public products;

    function Vendor(address serviceProvider, uint256 feeInPromille) {
        vendor = msg.sender;
        provider = serviceProvider;
        providerFeePromille = feeInPromille;
    }

    /**@dev Create product with specified features */
    function createProduct (
        string name, 
        uint256 unitPriceInWei, 
        bool isLimited, 
        uint256 maxQuantity, 
        bool allowFractions
    )
        onlyVendor
        returns (address) 
    {
        uint256 id = products.length;
        Product product = new Product(id, name, unitPriceInWei, isLimited, maxQuantity, allowFractions);
        products.push(product);

        ProductCreated(product, name);

        return products[id];
    }
}