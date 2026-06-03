import numpy as np
import tensorflow as tf
import os
import pickle
import json

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def lstm_forward(x_seq, kernel, recurrent_kernel, bias, return_sequences=True):
    # x_seq shape: (time_steps, input_dim)
    # kernel shape: (input_dim, 4 * units)
    # recurrent_kernel shape: (units, 4 * units)
    # bias shape: (4 * units)
    
    time_steps, input_dim = x_seq.shape
    units = recurrent_kernel.shape[0]
    
    # Split weights into gates: input, forget, cell, output
    W_i, W_f, W_c, W_o = np.split(kernel, 4, axis=-1)
    U_i, U_f, U_c, U_o = np.split(recurrent_kernel, 4, axis=-1)
    b_i, b_f, b_c, b_o = np.split(bias, 4, axis=-1)
    
    h = np.zeros(units)
    c = np.zeros(units)
    
    h_seq = []
    
    for t in range(time_steps):
        xt = x_seq[t]
        
        # Gates
        i_t = sigmoid(np.dot(xt, W_i) + np.dot(h, U_i) + b_i)
        f_t = sigmoid(np.dot(xt, W_f) + np.dot(h, U_f) + b_f)
        c_tilde = np.tanh(np.dot(xt, W_c) + np.dot(h, U_c) + b_c)
        
        c = f_t * c + i_t * c_tilde
        o_t = sigmoid(np.dot(xt, W_o) + np.dot(h, U_o) + b_o)
        h = o_t * np.tanh(c)
        
        h_seq.append(h)
        
    if return_sequences:
        return np.array(h_seq)
    else:
        return h

def predict_numpy(X_input, weights):
    # X_input shape: (1, time_steps, features)
    x = X_input[0] # shape: (time_steps, features)
    
    # LSTM 1 (return_sequences=True)
    x = lstm_forward(x, 
                     weights['lstm_kernel'], 
                     weights['lstm_recurrent_kernel'], 
                     weights['lstm_bias'], 
                     return_sequences=True)
    
    # LSTM 2 (return_sequences=False)
    x = lstm_forward(x, 
                     weights['lstm_1_kernel'], 
                     weights['lstm_1_recurrent_kernel'], 
                     weights['lstm_1_bias'], 
                     return_sequences=False)
    
    # Dense (relu)
    x = np.dot(x, weights['dense_kernel']) + weights['dense_bias']
    x = np.maximum(0, x) # ReLU
    
    # Dense 1 (linear)
    x = np.dot(x, weights['dense_1_kernel']) + weights['dense_1_bias']
    return x[0]

def main():
    model_path = 'models/aqi_lstm_model.h5'
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return
        
    print("Loading Keras model...")
    model = tf.keras.models.load_model(model_path, compile=False)
    
    # Extract weights
    weights = {}
    for layer in model.layers:
        name = layer.name
        layer_weights = layer.get_weights()
        if not layer_weights:
            continue
        print(f"Extracting layer {name} weights...")
        if 'lstm' in name:
            weights[f'{name}_kernel'] = layer_weights[0]
            weights[f'{name}_recurrent_kernel'] = layer_weights[1]
            weights[f'{name}_bias'] = layer_weights[2]
        elif 'dense' in name:
            weights[f'{name}_kernel'] = layer_weights[0]
            weights[f'{name}_bias'] = layer_weights[1]
            
    # Save weights
    out_path = 'models/lstm_weights.pkl'
    with open(out_path, 'wb') as f:
        pickle.dump(weights, f)
    print(f"Saved weights dictionary to {out_path}")
    
    # Verify with random input
    # Shape: (1, 7, 14)
    np.random.seed(42)
    test_input = np.random.rand(1, 7, 14).astype(np.float32)
    
    keras_pred = model.predict(test_input)[0][0]
    numpy_pred = predict_numpy(test_input, weights)
    
    diff = abs(keras_pred - numpy_pred)
    print(f"Keras prediction: {keras_pred:.6f}")
    print(f"Numpy prediction: {numpy_pred:.6f}")
    print(f"Absolute difference: {diff:.6e}")
    
    if diff < 1e-5:
        print("SUCCESS: Numpy forward pass matches Keras model perfectly!")
    else:
        print("ERROR: Predictions do not match!")

if __name__ == '__main__':
    main()
