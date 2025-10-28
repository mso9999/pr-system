"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSendGrid = void 0;
const functions = __importStar(require("firebase-functions"));
const sgMail = __importStar(require("@sendgrid/mail"));
exports.testSendGrid = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    try {
        // Set the API key
        const apiKey = (_a = functions.config().sendgrid) === null || _a === void 0 ? void 0 : _a.api_key;
        if (!apiKey) {
            throw new Error('SendGrid API key not found in configuration');
        }
        sgMail.setApiKey(apiKey);
        // Test email data
        const testEmail = {
            to: 'phoka@1pwrafrica.com', // Your email for testing
            from: 'noreply@1pwrafrica.com',
            subject: 'SendGrid Test Email',
            text: 'This is a test email to verify SendGrid configuration.',
            html: '<p>This is a test email to verify SendGrid configuration.</p>'
        };
        console.log('Attempting to send test email with SendGrid...');
        console.log('API Key format:', apiKey.startsWith('SG.') ? 'Valid format' : 'Invalid format');
        console.log('API Key length:', apiKey.length);
        // Send the test email
        const response = await sgMail.send(testEmail);
        console.log('SendGrid response:', response);
        return {
            success: true,
            message: 'Test email sent successfully',
            response: response[0],
            apiKeyFormat: apiKey.startsWith('SG.') ? 'Valid' : 'Invalid',
            apiKeyLength: apiKey.length
        };
    }
    catch (error) {
        console.error('SendGrid test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            apiKeyFormat: ((_c = (_b = functions.config().sendgrid) === null || _b === void 0 ? void 0 : _b.api_key) === null || _c === void 0 ? void 0 : _c.startsWith('SG.')) ? 'Valid' : 'Invalid',
            apiKeyLength: ((_e = (_d = functions.config().sendgrid) === null || _d === void 0 ? void 0 : _d.api_key) === null || _e === void 0 ? void 0 : _e.length) || 0
        };
    }
});
//# sourceMappingURL=testSendGrid.js.map