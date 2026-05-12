import tensorflow as tf

try:
    model = tf.keras.models.load_model('models/aqi_lstm_model.h5', compile=False)
    print("Model loaded successfully with compile=False")
except Exception as e:
    print(f"Failed again: {e}")
